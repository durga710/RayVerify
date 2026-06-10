import { FraudEventType } from '@prisma/client';
import { Detector, DetectionResult, VisitFeatureContext, notTriggered } from './types';

/**
 * ABNORMAL_DURATION — visit duration deviates sharply from the baseline for its
 * service code (z-score). Catches near-instant "drive-by" visits and implausibly
 * long ones inflating units.
 *
 *   z = (duration - mean) / std ; |z| >= 3 ⇒ anomaly
 */
export class AbnormalDurationDetector implements Detector {
  readonly type = FraudEventType.ABNORMAL_DURATION;
  readonly version = '1.0.0';

  detect(ctx: VisitFeatureContext): DetectionResult {
    const { visit, durationBaseline } = ctx;
    const duration = visit.durationMinutes ?? deriveDuration(visit.clockInAt, visit.clockOutAt);
    if (duration == null) return notTriggered(this.type, 'No duration available');

    // Hard floor: any completed visit under 2 minutes is suspicious regardless.
    if (duration < 2) {
      return {
        type: this.type,
        triggered: true,
        severity: 70,
        explanation: `Visit lasted only ${duration.toFixed(1)} min — implausibly short for a service visit.`,
        evidence: { durationMinutes: duration, rule: 'hard_floor_2min' },
      };
    }

    if (!durationBaseline || durationBaseline.stdMinutes <= 0) {
      return notTriggered(this.type, 'No baseline to compare duration');
    }

    const z = (duration - durationBaseline.meanMinutes) / durationBaseline.stdMinutes;
    if (Math.abs(z) < 3) {
      return notTriggered(this.type, `Duration within normal range (z=${z.toFixed(2)})`);
    }

    const severity = Math.min(100, 40 + Math.round((Math.abs(z) - 3) * 15));
    return {
      type: this.type,
      triggered: true,
      severity,
      explanation:
        `Visit duration ${duration.toFixed(0)} min is ${z > 0 ? 'far above' : 'far below'} the ` +
        `baseline for this service (mean ${durationBaseline.meanMinutes.toFixed(0)} min, z=${z.toFixed(1)}).`,
      evidence: {
        durationMinutes: duration,
        baselineMean: durationBaseline.meanMinutes,
        baselineStd: durationBaseline.stdMinutes,
        zScore: +z.toFixed(2),
      },
    };
  }
}

function deriveDuration(start?: Date | null, end?: Date | null): number | null {
  if (!start || !end) return null;
  return (end.getTime() - start.getTime()) / 60_000;
}
