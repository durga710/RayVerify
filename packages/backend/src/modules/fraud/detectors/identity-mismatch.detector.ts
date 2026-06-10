import { FraudEventType } from '@prisma/client';
import { Detector, DetectionResult, VisitFeatureContext, notTriggered } from './types';

/**
 * IDENTITY_MISMATCH / LIVENESS_FAILURE — the identity verification step failed
 * or returned low confidence/liveness, indicating the person clocking in may not
 * be the enrolled caregiver (or a spoof/presentation attack).
 */
export class IdentityMismatchDetector implements Detector {
  readonly type = FraudEventType.IDENTITY_MISMATCH;
  readonly version = '1.0.0';

  detect(ctx: VisitFeatureContext): DetectionResult {
    const { identity } = ctx;
    if (!identity) return notTriggered(this.type, 'No identity verification recorded');

    const conf = identity.confidenceScore ?? null;
    const live = identity.livenessScore ?? null;

    if (identity.result === 'PASS') {
      return notTriggered(this.type, 'Identity verification passed');
    }

    // FAIL is more severe than REVIEW; weak liveness adds a presentation-attack signal.
    let severity = identity.result === 'FAIL' ? 75 : 45;
    if (live != null && live < 0.9) severity = Math.min(100, severity + 15);
    if (conf != null && conf < 0.7) severity = Math.min(100, severity + 10);

    return {
      type: this.type,
      triggered: true,
      severity,
      explanation:
        `Identity verification returned ${identity.result}` +
        (conf != null ? `, match confidence ${(conf * 100).toFixed(0)}%` : '') +
        (live != null ? `, liveness ${(live * 100).toFixed(0)}%` : '') +
        ' — caregiver identity could not be confirmed.',
      evidence: {
        result: identity.result,
        confidenceScore: conf,
        livenessScore: live,
      },
    };
  }
}
