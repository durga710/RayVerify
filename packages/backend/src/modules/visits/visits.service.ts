import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DeviceTrustLevel,
  Prisma,
  VerificationResult,
  VisitStatus,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant-context';
import { haversineMeters } from '../../common/util/geo';
import { FraudService } from '../fraud/fraud.service';
import { CreateVisitDto, ClockEventDto, ClockOutDto } from './dto/visits.dto';

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fraud: FraudService,
  ) {}

  private orgId(): string {
    return TenantContext.require().organizationId;
  }

  async create(dto: CreateVisitDto) {
    const db = this.prisma.forRequest();
    return db.visit.create({
      data: {
        organizationId: this.orgId(),
        providerId: dto.providerId,
        caregiverId: dto.caregiverId,
        patientId: dto.patientId,
        authorizationId: dto.authorizationId,
        serviceCode: dto.serviceCode,
        scheduledStart: new Date(dto.scheduledStart),
        scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : null,
        status: VisitStatus.SCHEDULED,
      },
    });
  }

  /** Records clock-in: writes append-only GPS + device verification evidence. */
  async clockIn(visitId: string, dto: ClockEventDto) {
    const db = this.prisma.forRequest();
    const visit = await db.visit.findUnique({
      where: { id: visitId },
      include: { authorization: true },
    });
    if (!visit) throw new NotFoundException('Visit not found');

    const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : new Date();
    const gps = this.evaluateGeofence(dto, visit.authorization);

    await db.gpsVerification.create({
      data: {
        organizationId: visit.organizationId,
        visitId: visit.id,
        latitude: new Prisma.Decimal(dto.lat),
        longitude: new Prisma.Decimal(dto.lng),
        accuracyMeters: dto.accuracyMeters != null ? new Prisma.Decimal(dto.accuracyMeters) : null,
        distanceMeters: gps.distance != null ? new Prisma.Decimal(gps.distance.toFixed(2)) : null,
        result: gps.result,
        capturedAt,
        eventType: 'CLOCK_IN',
        rawPayload: { accuracyMeters: dto.accuracyMeters } as Prisma.InputJsonValue,
      },
    });

    let deviceUuid: string | undefined;
    if (dto.deviceId) {
      const device = await db.device.upsert({
        where: { organizationId_deviceId: { organizationId: visit.organizationId, deviceId: dto.deviceId } },
        create: { organizationId: visit.organizationId, deviceId: dto.deviceId, trustLevel: DeviceTrustLevel.UNKNOWN },
        update: { lastSeenAt: new Date() },
      });
      deviceUuid = device.id;
      await db.deviceVerification.create({
        data: {
          organizationId: visit.organizationId,
          visitId: visit.id,
          deviceId: device.id,
          result: this.deviceResult(device.trustLevel, device.isEmulator || device.isRooted || device.isJailbroken),
          trustLevel: device.trustLevel,
          signals: {
            isEmulator: device.isEmulator,
            isRooted: device.isRooted,
            isJailbroken: device.isJailbroken,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return db.visit.update({
      where: { id: visit.id },
      data: {
        status: VisitStatus.IN_PROGRESS,
        clockInAt: capturedAt,
        clockInLat: new Prisma.Decimal(dto.lat),
        clockInLng: new Prisma.Decimal(dto.lng),
        deviceId: deviceUuid,
      },
    });
  }

  async clockOut(visitId: string, dto: ClockOutDto) {
    const db = this.prisma.forRequest();
    const visit = await db.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit not found');

    const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : new Date();
    const duration = visit.clockInAt
      ? Math.round((capturedAt.getTime() - visit.clockInAt.getTime()) / 60000)
      : null;

    await db.gpsVerification.create({
      data: {
        organizationId: visit.organizationId,
        visitId: visit.id,
        latitude: new Prisma.Decimal(dto.lat),
        longitude: new Prisma.Decimal(dto.lng),
        result: VerificationResult.PASS,
        capturedAt,
        eventType: 'CLOCK_OUT',
      },
    });

    return db.visit.update({
      where: { id: visit.id },
      data: {
        status: VisitStatus.COMPLETED,
        clockOutAt: capturedAt,
        durationMinutes: duration,
        billedUnits: dto.billedUnits,
      },
    });
  }

  /**
   * Runs the full verification chain and produces the immutable rollup:
   *   identity → GPS → device → patient → fraud scoring → approval decision.
   */
  async runVerificationChain(visitId: string) {
    const db = this.prisma.forRequest();
    const visit = await db.visit.findUnique({
      where: { id: visitId },
      include: {
        identityVerifications: { orderBy: { createdAt: 'desc' }, take: 1 },
        gpsVerifications: { orderBy: { capturedAt: 'desc' }, take: 1 },
        deviceVerifications: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!visit) throw new NotFoundException('Visit not found');

    // Step results (missing evidence ⇒ REVIEW, never silently PASS).
    const identity = visit.identityVerifications[0]?.result ?? VerificationResult.REVIEW;
    const gps = visit.gpsVerifications[0]?.result ?? VerificationResult.REVIEW;
    const device = visit.deviceVerifications[0]?.result ?? VerificationResult.REVIEW;
    const patient = VerificationResult.PASS; // patient confirmation (stub for now)

    // Fraud scoring (Module 3).
    const scoring = await this.fraud.scoreVisit(visit.id);

    const chain = {
      identity,
      gps,
      device,
      patient,
      fraud: { score: scoring.composite.score, riskLevel: scoring.composite.riskLevel },
    };

    const overall = this.fuseChainResult([identity, gps, device, patient], scoring.composite.score);
    const evidenceHash = createHash('sha256')
      .update(JSON.stringify({ visitId: visit.id, chain, factors: scoring.composite.factors }))
      .digest('hex');

    await db.visitVerification.upsert({
      where: { visitId: visit.id },
      create: {
        organizationId: visit.organizationId,
        visitId: visit.id,
        result: overall,
        riskScore: scoring.composite.score,
        riskLevel: scoring.composite.riskLevel,
        chain: chain as Prisma.InputJsonValue,
        evidenceHash,
      },
      update: {
        result: overall,
        riskScore: scoring.composite.score,
        riskLevel: scoring.composite.riskLevel,
        chain: chain as Prisma.InputJsonValue,
        evidenceHash,
      },
    });

    const status =
      overall === VerificationResult.PASS
        ? VisitStatus.APPROVED
        : overall === VerificationResult.FAIL
          ? VisitStatus.REJECTED
          : VisitStatus.FLAGGED;

    await db.visit.update({
      where: { id: visit.id },
      data: { verificationResult: overall, status },
    });

    return { visitId: visit.id, result: overall, status, chain, evidenceHash, fraud: scoring.composite };
  }

  async findOne(visitId: string) {
    const db = this.prisma.forRequest();
    const visit = await db.visit.findUnique({
      where: { id: visitId },
      include: {
        visitVerification: true,
        identityVerifications: { orderBy: { createdAt: 'desc' } },
        gpsVerifications: { orderBy: { capturedAt: 'desc' } },
        deviceVerifications: { orderBy: { createdAt: 'desc' } },
        fraudEvents: { orderBy: { detectedAt: 'desc' } },
      },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    return visit;
  }

  async list(params: { status?: VisitStatus; skip: number; take: number }) {
    const db = this.prisma.forRequest();
    const where: Prisma.VisitWhereInput = params.status ? { status: params.status } : {};
    const [data, total] = await Promise.all([
      db.visit.findMany({ where, orderBy: { scheduledStart: 'desc' }, skip: params.skip, take: params.take }),
      db.visit.count({ where }),
    ]);
    return { data, total };
  }

  // ---- helpers ----

  private evaluateGeofence(
    dto: ClockEventDto,
    auth: { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null; radiusMeters: number } | null,
  ): { result: VerificationResult; distance: number | null } {
    if (!auth?.latitude || !auth?.longitude) {
      return { result: VerificationResult.REVIEW, distance: null };
    }
    const distance = haversineMeters(
      { lat: dto.lat, lng: dto.lng },
      { lat: Number(auth.latitude), lng: Number(auth.longitude) },
    );
    if (distance <= auth.radiusMeters) return { result: VerificationResult.PASS, distance };
    if (distance > auth.radiusMeters * 5) return { result: VerificationResult.FAIL, distance };
    return { result: VerificationResult.REVIEW, distance }; // FLAG
  }

  private deviceResult(trust: DeviceTrustLevel, tampered: boolean): VerificationResult {
    if (trust === DeviceTrustLevel.BLOCKED || tampered) return VerificationResult.FAIL;
    if (trust === DeviceTrustLevel.SUSPICIOUS || trust === DeviceTrustLevel.UNKNOWN) {
      return VerificationResult.REVIEW;
    }
    return VerificationResult.PASS;
  }

  /** Any FAIL ⇒ FAIL. Critical fraud (>80) ⇒ FAIL. Any REVIEW or high (>60) ⇒ REVIEW. */
  private fuseChainResult(steps: VerificationResult[], fraudScore: number): VerificationResult {
    if (steps.includes(VerificationResult.FAIL) || fraudScore > 80) return VerificationResult.FAIL;
    if (steps.includes(VerificationResult.REVIEW) || fraudScore > 60) return VerificationResult.REVIEW;
    return VerificationResult.PASS;
  }
}
