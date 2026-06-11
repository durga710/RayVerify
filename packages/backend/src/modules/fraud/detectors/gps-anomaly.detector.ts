import { FraudEventType } from '@prisma/client';
import { haversineMeters } from '../../../common/util/geo';
import { Detector, DetectionResult, VisitFeatureContext, notTriggered } from './types';

/**
 * GPS_ANOMALY / GEOFENCE_BREACH — clock-in location vs. the authorized service
 * address geofence.
 *   distance <= radius                  ⇒ PASS  (no event)
 *   radius < distance <= 5x radius      ⇒ FLAG  (moderate severity)
 *   distance > 5x radius (major)        ⇒ FAIL  (high severity)
 */
export class GpsAnomalyDetector implements Detector {
  readonly type = FraudEventType.GPS_ANOMALY;
  readonly version = '1.0.0';

  detect(ctx: VisitFeatureContext): DetectionResult {
    const { visit, authorization } = ctx;
    if (
      !authorization?.latitude ||
      !authorization?.longitude ||
      visit.clockInLat == null ||
      visit.clockInLng == null
    ) {
      return notTriggered(this.type, 'Insufficient geo data for geofence check');
    }

    const distance = haversineMeters(
      { lat: visit.clockInLat, lng: visit.clockInLng },
      { lat: authorization.latitude, lng: authorization.longitude },
    );
    const radius = authorization.radiusMeters;

    if (distance <= radius) {
      return notTriggered(this.type, `Inside approved radius (${distance.toFixed(0)}m ≤ ${radius}m)`);
    }

    const major = distance > radius * 5;
    const severity = major
      ? Math.min(100, 75 + Math.round((distance / (radius * 5)) * 5))
      : Math.min(70, 35 + Math.round(((distance - radius) / radius) * 10));

    return {
      type: this.type,
      triggered: true,
      severity,
      explanation:
        `Clock-in was ${distance.toFixed(0)}m from the authorized service address ` +
        `(approved radius ${radius}m). ${major ? 'Major discrepancy ⇒ FAIL.' : 'Outside radius ⇒ FLAG.'}`,
      evidence: {
        distanceMeters: Math.round(distance),
        radiusMeters: radius,
        decision: major ? 'FAIL' : 'FLAG',
        clockIn: { lat: visit.clockInLat, lng: visit.clockInLng },
        authorized: { lat: authorization.latitude, lng: authorization.longitude },
      },
    };
  }
}
