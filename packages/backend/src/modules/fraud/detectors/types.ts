import { FraudEventType } from '@prisma/client';

/**
 * Normalized, point-in-time view of a visit + its verification evidence and the
 * caregiver/patient history a detector needs. Assembled by FraudService so each
 * detector stays pure and unit-testable (no DB access inside detectors).
 */
export interface VisitFeatureContext {
  visit: {
    id: string;
    organizationId: string;
    caregiverId: string;
    patientId: string;
    providerId: string;
    serviceCode?: string | null;
    scheduledStart: Date;
    scheduledEnd?: Date | null;
    clockInAt?: Date | null;
    clockOutAt?: Date | null;
    durationMinutes?: number | null;
    clockInLat?: number | null;
    clockInLng?: number | null;
    deviceId?: string | null;
    billedUnits?: number | null;
  };
  authorization?: {
    latitude?: number | null;
    longitude?: number | null;
    radiusMeters: number;
    authorizedUnits?: number | null;
  } | null;
  identity?: {
    result: 'PASS' | 'REVIEW' | 'FAIL';
    confidenceScore?: number | null;
    livenessScore?: number | null;
  } | null;
  device?: {
    trustLevel: 'TRUSTED' | 'UNKNOWN' | 'SUSPICIOUS' | 'BLOCKED';
    isEmulator: boolean;
    isRooted: boolean;
    isJailbroken: boolean;
  } | null;
  /** Recent visits for the same caregiver (for impossible-travel / overlap). */
  caregiverRecentVisits: Array<{
    id: string;
    clockInAt?: Date | null;
    clockOutAt?: Date | null;
    clockInLat?: number | null;
    clockInLng?: number | null;
    patientId: string;
  }>;
  /** Recent visits for the same patient (for duplicate detection). */
  patientRecentVisits: Array<{
    id: string;
    caregiverId: string;
    clockInAt?: Date | null;
  }>;
  /** Distinct caregivers seen on this device recently (shared-device). */
  deviceCaregiverCount?: number;
  /** Baseline stats for ABNORMAL_DURATION (per service code). */
  durationBaseline?: { meanMinutes: number; stdMinutes: number };
  config: {
    impossibleTravelKmh: number;
    duplicateWindowMin: number;
  };
}

export interface DetectionResult {
  type: FraudEventType;
  /** 0–100 contribution toward the composite fraud score. 0 = not triggered. */
  severity: number;
  triggered: boolean;
  /** Human-readable explanation (explainability requirement). */
  explanation: string;
  /** Structured evidence persisted to fraud_events.evidence. */
  evidence: Record<string, unknown>;
}

export interface Detector {
  readonly type: FraudEventType;
  readonly version: string;
  detect(ctx: VisitFeatureContext): DetectionResult;
}

export function notTriggered(
  type: FraudEventType,
  reason = 'No anomaly detected',
): DetectionResult {
  return { type, severity: 0, triggered: false, explanation: reason, evidence: {} };
}
