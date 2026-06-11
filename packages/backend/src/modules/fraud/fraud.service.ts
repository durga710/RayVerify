import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FraudEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { scoreToRiskLevel } from '../../common/util/risk';
import { FraudScoringService, CompositeScore } from './fraud-scoring.service';
import { Detector, DetectionResult, VisitFeatureContext } from './detectors/types';
import { ImpossibleTravelDetector } from './detectors/impossible-travel.detector';
import { GpsAnomalyDetector } from './detectors/gps-anomaly.detector';
import { DuplicateVisitDetector } from './detectors/duplicate-visit.detector';
import { SharedDeviceDetector } from './detectors/shared-device.detector';
import { AbnormalDurationDetector } from './detectors/abnormal-duration.detector';
import { IdentityMismatchDetector } from './detectors/identity-mismatch.detector';

export interface VisitScoringOutcome {
  visitId: string;
  composite: CompositeScore;
  results: DetectionResult[];
  fraudEventIds: string[];
}

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  /** Rule-based detector registry. ML scorers are added via the async pipeline. */
  private readonly detectors: Detector[] = [
    new IdentityMismatchDetector(),
    new GpsAnomalyDetector(),
    new ImpossibleTravelDetector(),
    new DuplicateVisitDetector(),
    new SharedDeviceDetector(),
    new AbnormalDurationDetector(),
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: FraudScoringService,
    private readonly config: ConfigService,
  ) {}

  /** Pure evaluation: run all detectors over an assembled context and fuse. */
  evaluate(ctx: VisitFeatureContext): { results: DetectionResult[]; composite: CompositeScore } {
    const results = this.detectors.map((d) => d.detect(ctx));
    const composite = this.scoring.fuse(results);
    return { results, composite };
  }

  /**
   * Loads a visit + evidence, scores it, and persists fraud_events + a
   * fraud_score, then updates the visit's rolled-up risk. Assumes the caller has
   * bound the tenant context (HTTP request or queue worker).
   */
  async scoreVisit(visitId: string): Promise<VisitScoringOutcome> {
    const db = this.prisma.forRequest();
    const visit = await db.visit.findUnique({
      where: { id: visitId },
      include: {
        authorization: true,
        device: true,
        identityVerifications: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!visit) throw new NotFoundException('Visit not found');

    const ctx = await this.buildContext(visit);
    const { results, composite } = this.evaluate(ctx);

    const detectorByType = new Map(this.detectors.map((d) => [d.type, d]));
    const fraudEventIds: string[] = [];

    for (const r of results) {
      if (!r.triggered || r.severity <= 0) continue;
      const det = detectorByType.get(r.type);
      const created = await db.fraudEvent.create({
        data: {
          organizationId: visit.organizationId,
          visitId: visit.id,
          type: r.type,
          severity: r.severity,
          riskLevel: scoreToRiskLevel(r.severity),
          explanation: r.explanation,
          evidence: r.evidence as Prisma.InputJsonValue,
          detector: det?.constructor.name,
          detectorVersion: det?.version,
        },
        select: { id: true },
      });
      fraudEventIds.push(created.id);
    }

    await db.fraudScore.create({
      data: {
        organizationId: visit.organizationId,
        subjectType: 'VISIT',
        subjectId: visit.id,
        score: composite.score,
        riskLevel: composite.riskLevel,
        factors: composite.factors as unknown as Prisma.InputJsonValue,
        modelVersion: 'rules-1.0.0',
      },
    });

    await db.visit.update({
      where: { id: visit.id },
      data: { riskScore: composite.score, riskLevel: composite.riskLevel },
    });

    const autoFlag = this.config.get<number>('fraud.autoFlagScore') ?? 61;
    if (composite.score >= autoFlag) {
      this.logger.warn(
        `Visit ${visit.id} scored ${composite.score} (${composite.riskLevel}) — flagged for review`,
      );
      // In the full pipeline this fans out a notification and may open a case.
    }

    return { visitId: visit.id, composite, results, fraudEventIds };
  }

  /** Assembles the point-in-time feature context a set of detectors needs. */
  private async buildContext(
    visit: Prisma.VisitGetPayload<{
      include: { authorization: true; device: true; identityVerifications: true };
    }>,
  ): Promise<VisitFeatureContext> {
    const db = this.prisma.forRequest();
    const lookback = new Date(Date.now() - 24 * 3600 * 1000);

    const [caregiverRecent, patientRecent, deviceCaregivers] = await Promise.all([
      db.visit.findMany({
        where: { caregiverId: visit.caregiverId, clockInAt: { gte: lookback } },
        select: { id: true, clockInAt: true, clockOutAt: true, clockInLat: true, clockInLng: true, patientId: true },
        take: 50,
      }),
      db.visit.findMany({
        where: { patientId: visit.patientId, clockInAt: { gte: lookback } },
        select: { id: true, caregiverId: true, clockInAt: true },
        take: 50,
      }),
      visit.deviceId
        ? db.visit.findMany({
            where: { deviceId: visit.deviceId, clockInAt: { gte: lookback } },
            select: { caregiverId: true },
            take: 200,
          })
        : Promise.resolve([] as { caregiverId: string }[]),
    ]);

    const identity = visit.identityVerifications[0];

    return {
      visit: {
        id: visit.id,
        organizationId: visit.organizationId,
        caregiverId: visit.caregiverId,
        patientId: visit.patientId,
        providerId: visit.providerId,
        serviceCode: visit.serviceCode,
        scheduledStart: visit.scheduledStart,
        scheduledEnd: visit.scheduledEnd,
        clockInAt: visit.clockInAt,
        clockOutAt: visit.clockOutAt,
        durationMinutes: visit.durationMinutes,
        clockInLat: visit.clockInLat ? Number(visit.clockInLat) : null,
        clockInLng: visit.clockInLng ? Number(visit.clockInLng) : null,
        deviceId: visit.deviceId,
        billedUnits: visit.billedUnits,
      },
      authorization: visit.authorization
        ? {
            latitude: visit.authorization.latitude ? Number(visit.authorization.latitude) : null,
            longitude: visit.authorization.longitude ? Number(visit.authorization.longitude) : null,
            radiusMeters: visit.authorization.radiusMeters,
            authorizedUnits: visit.authorization.authorizedUnits,
          }
        : null,
      identity: identity
        ? {
            result: identity.result,
            confidenceScore: identity.confidenceScore ? Number(identity.confidenceScore) : null,
            livenessScore: identity.livenessScore ? Number(identity.livenessScore) : null,
          }
        : null,
      device: visit.device
        ? {
            trustLevel: visit.device.trustLevel,
            isEmulator: visit.device.isEmulator,
            isRooted: visit.device.isRooted,
            isJailbroken: visit.device.isJailbroken,
          }
        : null,
      caregiverRecentVisits: caregiverRecent.map((v) => ({
        id: v.id,
        clockInAt: v.clockInAt,
        clockOutAt: v.clockOutAt,
        clockInLat: v.clockInLat ? Number(v.clockInLat) : null,
        clockInLng: v.clockInLng ? Number(v.clockInLng) : null,
        patientId: v.patientId,
      })),
      patientRecentVisits: patientRecent.map((v) => ({
        id: v.id,
        caregiverId: v.caregiverId,
        clockInAt: v.clockInAt,
      })),
      deviceCaregiverCount: new Set(deviceCaregivers.map((d) => d.caregiverId)).size,
      config: {
        impossibleTravelKmh: this.config.get<number>('fraud.impossibleTravelKmh') ?? 900,
        duplicateWindowMin: this.config.get<number>('fraud.duplicateWindowMin') ?? 10,
      },
    };
  }

  /** Lists fraud events for the tenant with optional type/status filters. */
  async listEvents(params: { type?: FraudEventType; skip: number; take: number }) {
    const db = this.prisma.forRequest();
    const where: Prisma.FraudEventWhereInput = params.type ? { type: params.type } : {};
    const [data, total] = await Promise.all([
      db.fraudEvent.findMany({ where, orderBy: { detectedAt: 'desc' }, skip: params.skip, take: params.take }),
      db.fraudEvent.count({ where }),
    ]);
    return { data, total };
  }
}
