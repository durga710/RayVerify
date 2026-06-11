import { FraudEventType } from '@prisma/client';
import { haversineMeters, speedKmh } from '../../../common/util/geo';
import { Detector, DetectionResult, VisitFeatureContext, notTriggered } from './types';

/**
 * IMPOSSIBLE_TRAVEL — the caregiver appears at two locations too far apart to
 * have plausibly traveled between in the elapsed time (e.g. two clock-ins 300km
 * apart, 20 minutes apart ⇒ ~900 km/h ⇒ impossible by ground transport).
 *
 *   impliedSpeed = haversine(prev, curr) / (t_curr - t_prev)
 *   triggered    = impliedSpeed > config.impossibleTravelKmh
 */
export class ImpossibleTravelDetector implements Detector {
  readonly type = FraudEventType.IMPOSSIBLE_TRAVEL;
  readonly version = '1.0.0';

  detect(ctx: VisitFeatureContext): DetectionResult {
    const { visit, caregiverRecentVisits, config } = ctx;
    if (visit.clockInAt == null || visit.clockInLat == null || visit.clockInLng == null) {
      return notTriggered(this.type, 'No clock-in geo to compare');
    }

    const curr = {
      t: visit.clockInAt.getTime(),
      lat: visit.clockInLat,
      lng: visit.clockInLng,
    };

    let worst: { speed: number; distance: number; deltaMin: number; otherVisitId: string } | null =
      null;

    for (const prev of caregiverRecentVisits) {
      if (prev.id === visit.id) continue;
      const t = prev.clockInAt?.getTime();
      if (t == null || prev.clockInLat == null || prev.clockInLng == null) continue;
      const distance = haversineMeters(
        { lat: curr.lat, lng: curr.lng },
        { lat: prev.clockInLat, lng: prev.clockInLng },
      );
      const dt = Math.abs(curr.t - t);
      const speed = speedKmh(distance, dt);
      if (!worst || speed > worst.speed) {
        worst = { speed, distance, deltaMin: dt / 60000, otherVisitId: prev.id };
      }
    }

    if (!worst || worst.speed <= config.impossibleTravelKmh) {
      return notTriggered(this.type, 'Travel between visits is physically plausible');
    }

    // Severity scales with how far the implied speed exceeds the threshold.
    const ratio = worst.speed / config.impossibleTravelKmh;
    const severity = Math.min(100, Math.round(60 + (ratio - 1) * 40));

    return {
      type: this.type,
      triggered: true,
      severity,
      explanation:
        `Implied travel speed of ${worst.speed.toFixed(0)} km/h between consecutive ` +
        `clock-ins (${(worst.distance / 1000).toFixed(1)} km in ${worst.deltaMin.toFixed(0)} min) ` +
        `exceeds the plausible threshold of ${config.impossibleTravelKmh} km/h.`,
      evidence: {
        impliedSpeedKmh: Math.round(worst.speed),
        distanceKm: +(worst.distance / 1000).toFixed(2),
        deltaMinutes: +worst.deltaMin.toFixed(1),
        thresholdKmh: config.impossibleTravelKmh,
        comparedVisitId: worst.otherVisitId,
      },
    };
  }
}
