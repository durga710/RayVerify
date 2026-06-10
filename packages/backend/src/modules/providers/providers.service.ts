import { Injectable, NotFoundException } from '@nestjs/common';
import { FraudEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant-context';
import { clampScore, scoreToRiskLevel } from '../../common/util/risk';

interface TrendPoint {
  t: string;
  score: number;
}

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recomputes a provider's dynamic risk profile from aggregated signals:
   * verification failures, GPS/billing/identity anomalies, and case history.
   * Persists the snapshot and appends to the historical trend.
   */
  async recompute(providerId: string) {
    const db = this.prisma.forRequest();
    const orgId = TenantContext.require().organizationId;

    const provider = await db.provider.findUnique({ where: { id: providerId }, select: { id: true } });
    if (!provider) throw new NotFoundException('Provider not found');

    const byTypes = (types: FraudEventType[]) =>
      db.fraudEvent.count({ where: { type: { in: types }, visit: { providerId } } });

    const [
      verificationFailures,
      gpsAnomalies,
      billingAnomalies,
      identityIssues,
      openCases,
      substantiatedCases,
    ] = await Promise.all([
      db.visitVerification.count({ where: { result: 'FAIL', visit: { providerId } } }),
      byTypes([FraudEventType.GPS_ANOMALY, FraudEventType.GEOFENCE_BREACH]),
      byTypes([FraudEventType.UNUSUAL_BILLING, FraudEventType.EXCESSIVE_OVERTIME, FraudEventType.ABNORMAL_DURATION]),
      byTypes([FraudEventType.IDENTITY_MISMATCH, FraudEventType.LIVENESS_FAILURE]),
      db.fraudCase.count({ where: { providerId, status: { in: ['OPEN', 'IN_REVIEW', 'ESCALATED', 'PENDING_PAYMENT_HOLD'] } } }),
      db.fraudCase.count({ where: { providerId, status: 'SUBSTANTIATED' } }),
    ]);

    const currentScore = clampScore(
      verificationFailures * 5 +
        gpsAnomalies * 4 +
        billingAnomalies * 6 +
        identityIssues * 7 +
        openCases * 3 +
        substantiatedCases * 15,
    );
    const riskLevel = scoreToRiskLevel(currentScore);

    const existing = await db.providerRiskProfile.findUnique({ where: { providerId } });
    const trend: TrendPoint[] = Array.isArray(existing?.trend) ? (existing!.trend as unknown as TrendPoint[]) : [];
    trend.push({ t: new Date().toISOString(), score: currentScore });
    const trimmed = trend.slice(-90); // keep last 90 points

    return db.providerRiskProfile.upsert({
      where: { providerId },
      create: {
        organizationId: orgId,
        providerId,
        currentScore,
        riskLevel,
        verificationFailures,
        gpsAnomalies,
        billingAnomalies,
        identityIssues,
        openCases,
        substantiatedCases,
        trend: trimmed as unknown as Prisma.InputJsonValue,
        lastComputedAt: new Date(),
      },
      update: {
        currentScore,
        riskLevel,
        verificationFailures,
        gpsAnomalies,
        billingAnomalies,
        identityIssues,
        openCases,
        substantiatedCases,
        trend: trimmed as unknown as Prisma.InputJsonValue,
        lastComputedAt: new Date(),
      },
    });
  }

  /** Risk ranking for the investigator dashboard. */
  async ranking(params: { skip: number; take: number }) {
    const db = this.prisma.forRequest();
    const [data, total] = await Promise.all([
      db.providerRiskProfile.findMany({
        orderBy: { currentScore: 'desc' },
        skip: params.skip,
        take: params.take,
        include: { provider: { select: { id: true, legalName: true, npi: true } } },
      }),
      db.providerRiskProfile.count(),
    ]);
    return { data, total };
  }

  async getProfile(providerId: string) {
    const db = this.prisma.forRequest();
    const profile = await db.providerRiskProfile.findUnique({
      where: { providerId },
      include: { provider: { select: { id: true, legalName: true, npi: true } } },
    });
    if (!profile) throw new NotFoundException('No risk profile — recompute first');
    return profile;
  }
}
