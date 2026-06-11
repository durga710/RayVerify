/**
 * @rayverify/shared — cross-package contracts.
 *
 * Single source of truth for enums and value helpers shared by the NestJS
 * backend and the Next.js frontend. These mirror the Prisma enums (kept as
 * plain string-literal unions so the frontend never imports @prisma/client).
 */

export type VerificationResult = 'PASS' | 'REVIEW' | 'FAIL';
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type VisitStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FLAGGED'
  | 'REJECTED'
  | 'APPROVED'
  | 'CANCELLED';

export type FraudEventType =
  | 'IMPOSSIBLE_TRAVEL'
  | 'DUPLICATE_VISIT'
  | 'SHARED_DEVICE'
  | 'GPS_ANOMALY'
  | 'IDENTITY_MISMATCH'
  | 'UNUSUAL_BILLING'
  | 'ABNORMAL_DURATION'
  | 'EXCESSIVE_OVERTIME'
  | 'SERVICE_OVERLAP'
  | 'CROSS_PROVIDER_RISK'
  | 'LIVENESS_FAILURE'
  | 'DEVICE_TAMPERING'
  | 'GEOFENCE_BREACH';

export type CaseStatus =
  | 'OPEN'
  | 'IN_REVIEW'
  | 'ESCALATED'
  | 'PENDING_PAYMENT_HOLD'
  | 'SUBSTANTIATED'
  | 'UNSUBSTANTIATED'
  | 'CLOSED';

export type CasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/** Canonical risk bands — keep in lockstep with backend common/util/risk.ts. */
export const RISK_BANDS: ReadonlyArray<{ level: RiskLevel; min: number; max: number }> = [
  { level: 'LOW', min: 0, max: 30 },
  { level: 'MODERATE', min: 31, max: 60 },
  { level: 'HIGH', min: 61, max: 80 },
  { level: 'CRITICAL', min: 81, max: 100 },
];

export function scoreToRiskLevel(score: number): RiskLevel {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s <= 30) return 'LOW';
  if (s <= 60) return 'MODERATE';
  if (s <= 80) return 'HIGH';
  return 'CRITICAL';
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ScoreFactor {
  type: FraudEventType;
  severity: number;
  weight: number;
  contribution: number;
  explanation: string;
}
