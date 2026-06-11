import { FraudEventType } from '@prisma/client';
import { Detector, DetectionResult, VisitFeatureContext, notTriggered } from './types';

/**
 * DUPLICATE_VISIT — the same patient has another clock-in within a short window
 * (possible double-billing or split-claim). Distinct caregivers on overlapping
 * clock-ins for one patient is a stronger signal than the same caregiver.
 */
export class DuplicateVisitDetector implements Detector {
  readonly type = FraudEventType.DUPLICATE_VISIT;
  readonly version = '1.0.0';

  detect(ctx: VisitFeatureContext): DetectionResult {
    const { visit, patientRecentVisits, config } = ctx;
    if (visit.clockInAt == null) return notTriggered(this.type, 'No clock-in time');

    const windowMs = config.duplicateWindowMin * 60_000;
    const t = visit.clockInAt.getTime();

    const dupes = patientRecentVisits.filter((v) => {
      if (v.id === visit.id || v.clockInAt == null) return false;
      return Math.abs(v.clockInAt.getTime() - t) <= windowMs;
    });

    if (dupes.length === 0) {
      return notTriggered(this.type, 'No overlapping visits for this patient');
    }

    const differentCaregiver = dupes.some((d) => d.caregiverId !== visit.caregiverId);
    const severity = differentCaregiver ? 80 : 55;

    return {
      type: this.type,
      triggered: true,
      severity,
      explanation:
        `Patient has ${dupes.length} other clock-in(s) within ${config.duplicateWindowMin} ` +
        `minutes${differentCaregiver ? ' by a different caregiver' : ''} — possible duplicate/double-billing.`,
      evidence: {
        windowMinutes: config.duplicateWindowMin,
        duplicateVisitIds: dupes.map((d) => d.id),
        differentCaregiver,
      },
    };
  }
}
