import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityMethod, Prisma, VerificationResult } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  IDENTITY_PROVIDER,
  IdentityProvider,
} from './providers/identity-provider.interface';
import { VerifyIdentityDto } from './dto/identity.dto';

export interface IdentityVerificationOutcome {
  id: string;
  result: VerificationResult;
  confidence: number;
  liveness: number;
  reasons: string[];
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProvider,
  ) {}

  /**
   * Identity workflow: capture selfie → liveness → compare to enrolled face →
   * confidence score → store append-only verification event.
   */
  async verify(dto: VerifyIdentityDto): Promise<IdentityVerificationOutcome> {
    const db = this.prisma.forRequest();

    const caregiver = await db.caregiver.findUnique({
      where: { id: dto.caregiverId },
      include: { enrollments: { where: { isActive: true }, take: 1 } },
    });
    if (!caregiver) throw new NotFoundException('Caregiver not found');

    const enrollment = caregiver.enrollments[0];
    const match = await this.provider.compare({
      probeS3Key: dto.probeS3Key,
      referenceS3Key: enrollment?.referenceS3Key,
      templateRef: enrollment?.templateRef,
      simulate: dto.simulate,
    });

    const matchThreshold = this.config.get<number>('identity.matchThreshold') ?? 0.82;
    const livenessThreshold = this.config.get<number>('identity.livenessThreshold') ?? 0.9;
    const { result, reasons } = this.decide(match.confidence, match.liveness, matchThreshold, livenessThreshold, !!enrollment);

    const record = await db.identityVerification.create({
      data: {
        organizationId: caregiver.organizationId,
        visitId: dto.visitId ?? null,
        caregiverId: caregiver.id,
        method: IdentityMethod.SELFIE,
        result,
        confidenceScore: new Prisma.Decimal(match.confidence.toFixed(4)),
        livenessScore: new Prisma.Decimal(match.liveness.toFixed(4)),
        probeS3Key: dto.probeS3Key,
        matcher: match.matcher,
        reasons: reasons as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return { id: record.id, result, confidence: match.confidence, liveness: match.liveness, reasons };
  }

  private decide(
    confidence: number,
    liveness: number,
    matchThreshold: number,
    livenessThreshold: number,
    hasEnrollment: boolean,
  ): { result: VerificationResult; reasons: string[] } {
    const reasons: string[] = [];
    if (!hasEnrollment) reasons.push('No active biometric enrollment on file');

    const matchOk = confidence >= matchThreshold;
    const livenessOk = liveness >= livenessThreshold;
    const matchBorderline = confidence >= matchThreshold * 0.85;
    const livenessBorderline = liveness >= livenessThreshold * 0.85;

    reasons.push(
      `Face match ${(confidence * 100).toFixed(0)}% vs threshold ${(matchThreshold * 100).toFixed(0)}%`,
    );
    reasons.push(
      `Liveness ${(liveness * 100).toFixed(0)}% vs threshold ${(livenessThreshold * 100).toFixed(0)}%`,
    );

    let result: VerificationResult;
    if (hasEnrollment && matchOk && livenessOk) {
      result = VerificationResult.PASS;
    } else if (hasEnrollment && matchBorderline && livenessBorderline) {
      result = VerificationResult.REVIEW;
      reasons.push('Borderline scores — routed for manual review');
    } else {
      result = VerificationResult.FAIL;
      if (!livenessOk) reasons.push('Possible presentation/spoof attack (low liveness)');
      if (!matchOk) reasons.push('Face does not match enrolled caregiver');
    }
    return { result, reasons };
  }
}
