import { Injectable } from '@nestjs/common';
import { FraudEventType, RiskLevel } from '@prisma/client';
import { scoreToRiskLevel } from '../../common/util/risk';
import { DetectionResult } from './detectors/types';

export interface ScoreFactor {
  type: FraudEventType;
  severity: number;
  weight: number;
  contribution: number; // share of the final score, 0-1
  explanation: string;
}

export interface CompositeScore {
  score: number; // 0-100
  riskLevel: RiskLevel;
  factors: ScoreFactor[];
  triggeredCount: number;
}

/**
 * Fuses individual detector outputs into a single explainable 0–100 fraud score.
 *
 * We use a weighted noisy-OR: each detector contributes p_i = (severity/100)·w_i,
 * combined as 1 − Π(1 − p_i). This:
 *   • naturally caps at 100 (no arbitrary clipping),
 *   • lets a single strong signal score high,
 *   • rewards multiple independent signals (collusion is rarely one red flag),
 *   • yields per-detector contributions for explainability (required).
 */
@Injectable()
export class FraudScoringService {
  /** Relative trust/impact weight per detector. Tenant-overridable later. */
  private readonly weights: Record<FraudEventType, number> = {
    [FraudEventType.IMPOSSIBLE_TRAVEL]: 1.0,
    [FraudEventType.IDENTITY_MISMATCH]: 1.0,
    [FraudEventType.GEOFENCE_BREACH]: 0.9,
    [FraudEventType.GPS_ANOMALY]: 0.85,
    [FraudEventType.DUPLICATE_VISIT]: 0.9,
    [FraudEventType.SHARED_DEVICE]: 0.8,
    [FraudEventType.DEVICE_TAMPERING]: 0.85,
    [FraudEventType.LIVENESS_FAILURE]: 0.9,
    [FraudEventType.ABNORMAL_DURATION]: 0.6,
    [FraudEventType.EXCESSIVE_OVERTIME]: 0.6,
    [FraudEventType.SERVICE_OVERLAP]: 0.7,
    [FraudEventType.UNUSUAL_BILLING]: 0.7,
    [FraudEventType.CROSS_PROVIDER_RISK]: 0.75,
  };

  fuse(results: DetectionResult[]): CompositeScore {
    const triggered = results.filter((r) => r.triggered && r.severity > 0);

    if (triggered.length === 0) {
      return { score: 0, riskLevel: RiskLevel.LOW, factors: [], triggeredCount: 0 };
    }

    let complement = 1;
    const weighted = triggered.map((r) => {
      const weight = this.weights[r.type] ?? 0.7;
      const p = Math.min(1, (r.severity / 100) * weight);
      complement *= 1 - p;
      return { r, weight, p };
    });

    const combined = 1 - complement; // 0..1
    const score = Math.round(combined * 100);

    // Attribute the final score across detectors proportional to their p_i.
    const pSum = weighted.reduce((acc, w) => acc + w.p, 0) || 1;
    const factors: ScoreFactor[] = weighted
      .map(({ r, weight, p }) => ({
        type: r.type,
        severity: r.severity,
        weight,
        contribution: +(p / pSum).toFixed(4),
        explanation: r.explanation,
      }))
      .sort((a, b) => b.contribution - a.contribution);

    return {
      score,
      riskLevel: scoreToRiskLevel(score),
      factors,
      triggeredCount: triggered.length,
    };
  }
}
