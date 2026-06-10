// =============================================================================
// RayVerify™ — Mock data (used by pages without a backend)
// All data is typed and deterministic.
// =============================================================================

import {
  AuditAction,
  AuditLog,
  CaseEvidence,
  CaseNote,
  CasePriority,
  CaseStatus,
  DevicePlatform,
  DeviceTrustLevel,
  FraudCase,
  FraudEvent,
  FraudEventStatus,
  FraudEventType,
  FraudTrendPoint,
  IdentityMethod,
  Organization,
  OverviewStats,
  Provider,
  ProviderRiskProfile,
  Report,
  ReportFormat,
  ReportStatus,
  ReportType,
  RiskDistribution,
  RiskLevel,
  TrendPoint,
  User,
  UserStatus,
  VerificationChain,
  VerificationResult,
  Visit,
  VisitStatus,
  VisitVerification,
} from "./types";

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export const MOCK_ORGS: Organization[] = [
  {
    id: "org-001",
    name: "Maryland Medicaid OIG",
    slug: "md-oig",
    jurisdiction: "MD",
    isActive: true,
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "org-002",
    name: "Virginia DMAS Integrity Unit",
    slug: "va-dmas",
    jurisdiction: "VA",
    isActive: true,
    createdAt: "2024-03-01T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const MOCK_USERS: User[] = [
  {
    id: "user-001",
    organizationId: "org-001",
    email: "s.reyes@md-oig.gov",
    firstName: "Sofia",
    lastName: "Reyes",
    status: UserStatus.ACTIVE,
    lastLoginAt: "2026-06-10T08:12:00Z",
    createdAt: "2024-02-01T00:00:00Z",
    roles: ["INVESTIGATOR"],
  },
  {
    id: "user-002",
    organizationId: "org-001",
    email: "m.johnson@md-oig.gov",
    firstName: "Marcus",
    lastName: "Johnson",
    status: UserStatus.ACTIVE,
    lastLoginAt: "2026-06-09T17:45:00Z",
    createdAt: "2024-02-15T00:00:00Z",
    roles: ["AUDITOR"],
  },
  {
    id: "user-003",
    organizationId: "org-001",
    email: "l.chen@md-oig.gov",
    firstName: "Linda",
    lastName: "Chen",
    status: UserStatus.ACTIVE,
    lastLoginAt: "2026-06-10T07:00:00Z",
    createdAt: "2024-03-10T00:00:00Z",
    roles: ["COMPLIANCE_OFFICER"],
  },
  {
    id: "user-004",
    organizationId: "org-001",
    email: "d.okafor@md-oig.gov",
    firstName: "David",
    lastName: "Okafor",
    status: UserStatus.ACTIVE,
    lastLoginAt: "2026-06-08T14:20:00Z",
    createdAt: "2024-04-01T00:00:00Z",
    roles: ["OIG_AGENT"],
  },
];

export const MOCK_CURRENT_USER: User = MOCK_USERS[0];

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export const MOCK_PROVIDERS: Provider[] = [
  {
    id: "prov-001",
    organizationId: "org-001",
    npi: "1234567890",
    medicaidId: "MD-PROV-00441",
    legalName: "SunCare Home Health LLC",
    isActive: true,
    enrolledAt: "2022-07-01T00:00:00Z",
  },
  {
    id: "prov-002",
    organizationId: "org-001",
    npi: "0987654321",
    medicaidId: "MD-PROV-00892",
    legalName: "Guardian Personal Care Services",
    isActive: true,
    enrolledAt: "2021-03-15T00:00:00Z",
  },
  {
    id: "prov-003",
    organizationId: "org-001",
    npi: "1122334455",
    medicaidId: "MD-PROV-01137",
    legalName: "Bright Horizons HCBS",
    isActive: true,
    enrolledAt: "2023-01-10T00:00:00Z",
  },
  {
    id: "prov-004",
    organizationId: "org-001",
    npi: "5566778899",
    medicaidId: "MD-PROV-00234",
    legalName: "Premier Care Coordination Inc.",
    isActive: true,
    enrolledAt: "2020-11-22T00:00:00Z",
  },
  {
    id: "prov-005",
    organizationId: "org-001",
    npi: "9988776655",
    medicaidId: "MD-PROV-02019",
    legalName: "ComfortPath Home Services",
    isActive: false,
    enrolledAt: "2023-06-01T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Provider Risk Profiles
// ---------------------------------------------------------------------------

function makeTrend(baseScore: number, months = 6): TrendPoint[] {
  const now = new Date("2026-06-10");
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (months - 1 - i));
    const jitter = Math.round((Math.random() - 0.5) * 12);
    return {
      t: d.toISOString().slice(0, 10),
      score: Math.max(0, Math.min(100, baseScore + jitter)),
    };
  });
}

export const MOCK_RISK_PROFILES: ProviderRiskProfile[] = [
  {
    id: "rp-001",
    organizationId: "org-001",
    providerId: "prov-001",
    currentScore: 87,
    riskLevel: RiskLevel.CRITICAL,
    verificationFailures: 23,
    gpsAnomalies: 18,
    billingAnomalies: 9,
    identityIssues: 11,
    openCases: 4,
    substantiatedCases: 2,
    trend: makeTrend(87),
    lastComputedAt: "2026-06-10T06:00:00Z",
    provider: MOCK_PROVIDERS[0],
  },
  {
    id: "rp-002",
    organizationId: "org-001",
    providerId: "prov-002",
    currentScore: 71,
    riskLevel: RiskLevel.HIGH,
    verificationFailures: 14,
    gpsAnomalies: 8,
    billingAnomalies: 6,
    identityIssues: 5,
    openCases: 2,
    substantiatedCases: 1,
    trend: makeTrend(71),
    lastComputedAt: "2026-06-10T06:00:00Z",
    provider: MOCK_PROVIDERS[1],
  },
  {
    id: "rp-003",
    organizationId: "org-001",
    providerId: "prov-003",
    currentScore: 42,
    riskLevel: RiskLevel.MODERATE,
    verificationFailures: 5,
    gpsAnomalies: 3,
    billingAnomalies: 2,
    identityIssues: 1,
    openCases: 1,
    substantiatedCases: 0,
    trend: makeTrend(42),
    lastComputedAt: "2026-06-10T06:00:00Z",
    provider: MOCK_PROVIDERS[2],
  },
  {
    id: "rp-004",
    organizationId: "org-001",
    providerId: "prov-004",
    currentScore: 19,
    riskLevel: RiskLevel.LOW,
    verificationFailures: 1,
    gpsAnomalies: 0,
    billingAnomalies: 1,
    identityIssues: 0,
    openCases: 0,
    substantiatedCases: 0,
    trend: makeTrend(19),
    lastComputedAt: "2026-06-10T06:00:00Z",
    provider: MOCK_PROVIDERS[3],
  },
  {
    id: "rp-005",
    organizationId: "org-001",
    providerId: "prov-005",
    currentScore: 65,
    riskLevel: RiskLevel.HIGH,
    verificationFailures: 9,
    gpsAnomalies: 7,
    billingAnomalies: 4,
    identityIssues: 3,
    openCases: 1,
    substantiatedCases: 0,
    trend: makeTrend(65),
    lastComputedAt: "2026-06-09T06:00:00Z",
    provider: MOCK_PROVIDERS[4],
  },
];

// ---------------------------------------------------------------------------
// Fraud Events
// ---------------------------------------------------------------------------

export const MOCK_FRAUD_EVENTS: FraudEvent[] = [
  {
    id: "fe-001",
    organizationId: "org-001",
    visitId: "v-001",
    caseId: "case-001",
    type: FraudEventType.IMPOSSIBLE_TRAVEL,
    status: FraudEventStatus.CONFIRMED,
    severity: 92,
    riskLevel: RiskLevel.CRITICAL,
    explanation:
      "Caregiver clocked in at two locations 47 miles apart within 28 minutes — physically impossible.",
    detector: "travel-velocity-v2",
    detectedAt: "2026-06-10T07:14:22Z",
  },
  {
    id: "fe-002",
    organizationId: "org-001",
    visitId: "v-002",
    type: FraudEventType.GPS_ANOMALY,
    status: FraudEventStatus.OPEN,
    severity: 76,
    riskLevel: RiskLevel.HIGH,
    explanation:
      "Clock-in GPS coordinate is 2.3 km from the authorized service address (threshold: 150 m).",
    detector: "geofence-check-v3",
    detectedAt: "2026-06-10T08:02:11Z",
  },
  {
    id: "fe-003",
    organizationId: "org-001",
    visitId: "v-003",
    caseId: "case-002",
    type: FraudEventType.DUPLICATE_VISIT,
    status: FraudEventStatus.LINKED_TO_CASE,
    severity: 88,
    riskLevel: RiskLevel.CRITICAL,
    explanation:
      "Visit overlaps with another approved visit for the same caregiver — 4-hour overlap.",
    detector: "overlap-detector-v1",
    detectedAt: "2026-06-09T14:37:05Z",
  },
  {
    id: "fe-004",
    organizationId: "org-001",
    visitId: "v-004",
    type: FraudEventType.LIVENESS_FAILURE,
    status: FraudEventStatus.OPEN,
    severity: 85,
    riskLevel: RiskLevel.CRITICAL,
    explanation:
      "Liveness probability 0.21 — below acceptance threshold 0.80. Possible photo substitution.",
    detector: "liveness-model-v4",
    detectedAt: "2026-06-10T09:21:44Z",
  },
  {
    id: "fe-005",
    organizationId: "org-001",
    visitId: "v-005",
    type: FraudEventType.SHARED_DEVICE,
    status: FraudEventStatus.TRIAGED,
    severity: 62,
    riskLevel: RiskLevel.HIGH,
    explanation:
      "Device fingerprint matches 7 distinct caregiver accounts in the past 30 days.",
    detector: "device-share-v2",
    detectedAt: "2026-06-09T11:08:31Z",
  },
  {
    id: "fe-006",
    organizationId: "org-001",
    visitId: "v-006",
    type: FraudEventType.UNUSUAL_BILLING,
    status: FraudEventStatus.OPEN,
    severity: 55,
    riskLevel: RiskLevel.MODERATE,
    explanation:
      "Billed 312 units this month vs. 30-day rolling average of 180 units (+73%).",
    detector: "billing-anomaly-v1",
    detectedAt: "2026-06-08T16:45:10Z",
  },
  {
    id: "fe-007",
    organizationId: "org-001",
    visitId: "v-007",
    type: FraudEventType.IDENTITY_MISMATCH,
    status: FraudEventStatus.CONFIRMED,
    severity: 91,
    riskLevel: RiskLevel.CRITICAL,
    explanation:
      "Face match confidence 0.41 against enrolled biometric (threshold: 0.85).",
    detector: "face-match-v5",
    detectedAt: "2026-06-07T10:15:00Z",
  },
  {
    id: "fe-008",
    organizationId: "org-001",
    type: FraudEventType.DEVICE_TAMPERING,
    status: FraudEventStatus.DISMISSED,
    severity: 35,
    riskLevel: RiskLevel.MODERATE,
    explanation: "Device reported as rooted; however, it is a known test device.",
    detector: "device-posture-v2",
    detectedAt: "2026-06-06T13:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Fraud Cases
// ---------------------------------------------------------------------------

export const MOCK_CASES: FraudCase[] = [
  {
    id: "case-001",
    organizationId: "org-001",
    caseNumber: "RV-2026-000041",
    title: "SunCare — Impossible Travel Pattern (Multiple Caregivers)",
    status: CaseStatus.ESCALATED,
    priority: CasePriority.URGENT,
    riskLevel: RiskLevel.CRITICAL,
    providerId: "prov-001",
    assigneeId: "user-001",
    exposureCents: 187_40000,
    summary:
      "Pattern of impossible-travel fraud events detected across 6 caregivers enrolled under SunCare Home Health LLC. Estimated fraudulent billing: $187,400 over 90 days.",
    openedAt: "2026-05-22T09:00:00Z",
    updatedAt: "2026-06-10T08:45:00Z",
    provider: MOCK_PROVIDERS[0],
    assignee: MOCK_USERS[0],
    events: [MOCK_FRAUD_EVENTS[0]],
  },
  {
    id: "case-002",
    organizationId: "org-001",
    caseNumber: "RV-2026-000038",
    title: "Guardian — Overlapping Visit Submissions",
    status: CaseStatus.IN_REVIEW,
    priority: CasePriority.HIGH,
    riskLevel: RiskLevel.HIGH,
    providerId: "prov-002",
    assigneeId: "user-004",
    exposureCents: 62_80000,
    summary:
      "12 visits flagged for temporal overlap with other approved visits under the same caregiver. Payment holds have been requested.",
    openedAt: "2026-05-30T14:30:00Z",
    updatedAt: "2026-06-09T16:00:00Z",
    provider: MOCK_PROVIDERS[1],
    assignee: MOCK_USERS[3],
    events: [MOCK_FRAUD_EVENTS[2]],
  },
  {
    id: "case-003",
    organizationId: "org-001",
    caseNumber: "RV-2026-000051",
    title: "SunCare — Identity Mismatch / Liveness Failures",
    status: CaseStatus.PENDING_PAYMENT_HOLD,
    priority: CasePriority.URGENT,
    riskLevel: RiskLevel.CRITICAL,
    providerId: "prov-001",
    assigneeId: "user-001",
    exposureCents: 44_20000,
    summary:
      "Seven visits with liveness failures and low face-match scores indicate a proxy worker fraud scheme.",
    openedAt: "2026-06-05T11:00:00Z",
    updatedAt: "2026-06-10T07:15:00Z",
    provider: MOCK_PROVIDERS[0],
    assignee: MOCK_USERS[0],
    events: [MOCK_FRAUD_EVENTS[3], MOCK_FRAUD_EVENTS[6]],
  },
  {
    id: "case-004",
    organizationId: "org-001",
    caseNumber: "RV-2026-000029",
    title: "Bright Horizons — Billing Anomaly Review",
    status: CaseStatus.OPEN,
    priority: CasePriority.MEDIUM,
    riskLevel: RiskLevel.MODERATE,
    providerId: "prov-003",
    assigneeId: "user-002",
    exposureCents: 21_50000,
    summary:
      "Provider billing volume increased 73% month-over-month with no corresponding increase in authorized beneficiaries.",
    openedAt: "2026-06-08T10:00:00Z",
    updatedAt: "2026-06-08T10:00:00Z",
    provider: MOCK_PROVIDERS[2],
    assignee: MOCK_USERS[1],
    events: [MOCK_FRAUD_EVENTS[5]],
  },
  {
    id: "case-005",
    organizationId: "org-001",
    caseNumber: "RV-2026-000012",
    title: "Premier Care — Historical Substantiated Fraud",
    status: CaseStatus.SUBSTANTIATED,
    priority: CasePriority.HIGH,
    riskLevel: RiskLevel.HIGH,
    providerId: "prov-004",
    assigneeId: "user-003",
    exposureCents: 315_00000,
    summary:
      "Substantiated billing fraud across 3 years. Case referred to state AG. $315,000 recoupment order issued.",
    openedAt: "2025-09-01T00:00:00Z",
    closedAt: "2026-04-30T00:00:00Z",
    updatedAt: "2026-04-30T00:00:00Z",
    provider: MOCK_PROVIDERS[3],
    assignee: MOCK_USERS[2],
  },
];

// ---------------------------------------------------------------------------
// Case Notes & Evidence
// ---------------------------------------------------------------------------

export const MOCK_CASE_NOTES: CaseNote[] = [
  {
    id: "cn-001",
    caseId: "case-001",
    authorId: "user-001",
    body: "Subpoenaed phone records to corroborate travel log timestamps. Awaiting response from telecom.",
    isInternal: true,
    createdAt: "2026-06-09T15:30:00Z",
    author: MOCK_USERS[0],
  },
  {
    id: "cn-002",
    caseId: "case-001",
    authorId: "user-004",
    body: "Cross-referenced visit timestamps with payroll records from provider. Three caregivers show identical patterns.",
    isInternal: true,
    createdAt: "2026-06-08T11:00:00Z",
    author: MOCK_USERS[3],
  },
  {
    id: "cn-003",
    caseId: "case-001",
    authorId: "user-001",
    body: "Payment hold placed on $52,000 in pending claims. Finance notified.",
    isInternal: false,
    createdAt: "2026-06-07T09:00:00Z",
    author: MOCK_USERS[0],
  },
];

export const MOCK_CASE_EVIDENCE: CaseEvidence[] = [
  {
    id: "ev-001",
    caseId: "case-001",
    label: "GPS Verification Records — Visit V-00441",
    kind: "GPS",
    refId: "v-001",
    contentHash: "sha256:a3f8c21d...",
    createdAt: "2026-06-09T15:31:00Z",
  },
  {
    id: "ev-002",
    caseId: "case-001",
    label: "Identity Verification Probe Image — Caregiver CGV-0087",
    kind: "IDENTITY",
    refId: "fe-001",
    contentHash: "sha256:b7d912e4...",
    createdAt: "2026-06-09T15:32:00Z",
  },
  {
    id: "ev-003",
    caseId: "case-001",
    label: "Exported Fraud Score Timeline — Provider SunCare",
    kind: "EXPORT",
    contentHash: "sha256:c1e4f609...",
    createdAt: "2026-06-08T12:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------------

function makeVerificationChain(
  identityResult: VerificationResult,
  gpsResult: VerificationResult,
  deviceResult: VerificationResult,
  overallResult: VerificationResult
): VerificationChain {
  return {
    identity: {
      step: "identity",
      result: identityResult,
      score: identityResult === VerificationResult.PASS ? 95 : identityResult === VerificationResult.REVIEW ? 60 : 20,
      label: "Identity Verification",
      method: IdentityMethod.SELFIE,
      details:
        identityResult === VerificationResult.PASS
          ? "Face match confidence: 0.96 · Liveness: 0.98"
          : identityResult === VerificationResult.REVIEW
          ? "Face match confidence: 0.61 · Liveness: 0.78"
          : "Face match confidence: 0.21 · Liveness: 0.19",
      timestamp: "2026-06-10T08:01:10Z",
    },
    gps: {
      step: "gps",
      result: gpsResult,
      score: gpsResult === VerificationResult.PASS ? 98 : gpsResult === VerificationResult.REVIEW ? 55 : 10,
      label: "GPS Geofence Check",
      details:
        gpsResult === VerificationResult.PASS
          ? "Distance: 43 m (threshold: 150 m)"
          : gpsResult === VerificationResult.REVIEW
          ? "Distance: 320 m (threshold: 150 m)"
          : "Distance: 2.3 km (threshold: 150 m)",
      timestamp: "2026-06-10T08:01:15Z",
    },
    device: {
      step: "device",
      result: deviceResult,
      score: deviceResult === VerificationResult.PASS ? 99 : 45,
      label: "Device Trust",
      details:
        deviceResult === VerificationResult.PASS
          ? "Trust level: TRUSTED · Not emulator · Not rooted"
          : "Trust level: SUSPICIOUS · Emulator detected",
      timestamp: "2026-06-10T08:01:05Z",
    },
    patient: {
      step: "patient",
      result: VerificationResult.PASS,
      score: 100,
      label: "Patient Confirmation",
      details: "Patient PIN confirmed",
      timestamp: "2026-06-10T08:01:20Z",
    },
    fraud: {
      step: "fraud",
      result: overallResult,
      score: overallResult === VerificationResult.PASS ? 12 : overallResult === VerificationResult.REVIEW ? 55 : 92,
      label: "Fraud Score",
      details:
        overallResult === VerificationResult.PASS
          ? "No anomalies detected · Score: 12"
          : overallResult === VerificationResult.REVIEW
          ? "GPS anomaly detected · Score: 55"
          : "Impossible travel + identity mismatch · Score: 92",
      timestamp: "2026-06-10T08:01:25Z",
    },
  };
}

export const MOCK_VISITS: Visit[] = [
  {
    id: "v-001",
    organizationId: "org-001",
    providerId: "prov-001",
    caregiverId: "cg-001",
    patientId: "pat-001",
    serviceCode: "T1019",
    status: VisitStatus.FLAGGED,
    scheduledStart: "2026-06-10T08:00:00Z",
    scheduledEnd: "2026-06-10T12:00:00Z",
    clockInAt: "2026-06-10T08:01:00Z",
    clockOutAt: "2026-06-10T12:03:00Z",
    durationMinutes: 242,
    clockInLat: 39.2904,
    clockInLng: -76.6122,
    billedAmountCents: 48000,
    verificationResult: VerificationResult.FAIL,
    riskScore: 92,
    riskLevel: RiskLevel.CRITICAL,
    createdAt: "2026-06-10T08:01:30Z",
    provider: MOCK_PROVIDERS[0],
    visitVerification: {
      id: "vv-001",
      visitId: "v-001",
      result: VerificationResult.FAIL,
      riskScore: 92,
      riskLevel: RiskLevel.CRITICAL,
      chain: makeVerificationChain(
        VerificationResult.FAIL,
        VerificationResult.FAIL,
        VerificationResult.PASS,
        VerificationResult.FAIL
      ),
      evidenceHash: "sha256:a3f8c21d4b...",
      createdAt: "2026-06-10T08:01:30Z",
    },
  },
  {
    id: "v-002",
    organizationId: "org-001",
    providerId: "prov-002",
    caregiverId: "cg-002",
    patientId: "pat-002",
    serviceCode: "T1019",
    status: VisitStatus.FLAGGED,
    scheduledStart: "2026-06-10T09:00:00Z",
    scheduledEnd: "2026-06-10T13:00:00Z",
    clockInAt: "2026-06-10T09:02:00Z",
    durationMinutes: 0,
    clockInLat: 39.1,
    clockInLng: -76.9,
    billedAmountCents: 38400,
    verificationResult: VerificationResult.REVIEW,
    riskScore: 68,
    riskLevel: RiskLevel.HIGH,
    createdAt: "2026-06-10T09:02:30Z",
    provider: MOCK_PROVIDERS[1],
    visitVerification: {
      id: "vv-002",
      visitId: "v-002",
      result: VerificationResult.REVIEW,
      riskScore: 68,
      riskLevel: RiskLevel.HIGH,
      chain: makeVerificationChain(
        VerificationResult.PASS,
        VerificationResult.REVIEW,
        VerificationResult.PASS,
        VerificationResult.REVIEW
      ),
      evidenceHash: "sha256:b9e231...",
      createdAt: "2026-06-10T09:02:30Z",
    },
  },
  {
    id: "v-003",
    organizationId: "org-001",
    providerId: "prov-001",
    caregiverId: "cg-003",
    patientId: "pat-003",
    serviceCode: "T1020",
    status: VisitStatus.APPROVED,
    scheduledStart: "2026-06-10T07:00:00Z",
    scheduledEnd: "2026-06-10T11:00:00Z",
    clockInAt: "2026-06-10T07:01:00Z",
    clockOutAt: "2026-06-10T11:02:00Z",
    durationMinutes: 241,
    clockInLat: 39.3011,
    clockInLng: -76.6107,
    billedAmountCents: 51200,
    verificationResult: VerificationResult.PASS,
    riskScore: 11,
    riskLevel: RiskLevel.LOW,
    createdAt: "2026-06-10T07:01:30Z",
    provider: MOCK_PROVIDERS[0],
    visitVerification: {
      id: "vv-003",
      visitId: "v-003",
      result: VerificationResult.PASS,
      riskScore: 11,
      riskLevel: RiskLevel.LOW,
      chain: makeVerificationChain(
        VerificationResult.PASS,
        VerificationResult.PASS,
        VerificationResult.PASS,
        VerificationResult.PASS
      ),
      evidenceHash: "sha256:c2a917...",
      createdAt: "2026-06-10T07:01:30Z",
    },
  },
  {
    id: "v-004",
    organizationId: "org-001",
    providerId: "prov-002",
    caregiverId: "cg-004",
    patientId: "pat-004",
    serviceCode: "T1019",
    status: VisitStatus.REJECTED,
    scheduledStart: "2026-06-10T10:00:00Z",
    scheduledEnd: "2026-06-10T14:00:00Z",
    clockInAt: "2026-06-10T10:01:00Z",
    durationMinutes: 0,
    billedAmountCents: 38400,
    verificationResult: VerificationResult.FAIL,
    riskScore: 88,
    riskLevel: RiskLevel.CRITICAL,
    createdAt: "2026-06-10T10:01:30Z",
    provider: MOCK_PROVIDERS[1],
    visitVerification: {
      id: "vv-004",
      visitId: "v-004",
      result: VerificationResult.FAIL,
      riskScore: 88,
      riskLevel: RiskLevel.CRITICAL,
      chain: makeVerificationChain(
        VerificationResult.FAIL,
        VerificationResult.PASS,
        VerificationResult.REVIEW,
        VerificationResult.FAIL
      ),
      evidenceHash: "sha256:d1c833...",
      createdAt: "2026-06-10T10:01:30Z",
    },
  },
  {
    id: "v-005",
    organizationId: "org-001",
    providerId: "prov-003",
    caregiverId: "cg-005",
    patientId: "pat-005",
    serviceCode: "T1019",
    status: VisitStatus.COMPLETED,
    scheduledStart: "2026-06-09T09:00:00Z",
    scheduledEnd: "2026-06-09T13:00:00Z",
    clockInAt: "2026-06-09T09:00:00Z",
    clockOutAt: "2026-06-09T13:05:00Z",
    durationMinutes: 245,
    billedAmountCents: 48000,
    verificationResult: VerificationResult.PASS,
    riskScore: 21,
    riskLevel: RiskLevel.LOW,
    createdAt: "2026-06-09T09:00:30Z",
    provider: MOCK_PROVIDERS[2],
    visitVerification: {
      id: "vv-005",
      visitId: "v-005",
      result: VerificationResult.PASS,
      riskScore: 21,
      riskLevel: RiskLevel.LOW,
      chain: makeVerificationChain(
        VerificationResult.PASS,
        VerificationResult.PASS,
        VerificationResult.PASS,
        VerificationResult.PASS
      ),
      evidenceHash: "sha256:e5b144...",
      createdAt: "2026-06-09T09:00:30Z",
    },
  },
];

// ---------------------------------------------------------------------------
// Overview Stats
// ---------------------------------------------------------------------------

export const MOCK_OVERVIEW_STATS: OverviewStats = {
  openCases: 47,
  criticalAlerts: 12,
  dollarAtRiskCents: 2_140_00000,
  visitsVerifiedToday: 1842,
  falsePositiveRate: 3.2,
  visitsVerifiedChange: 4.7,
  openCasesChange: -2.1,
  criticalAlertsChange: 16.7,
};

// ---------------------------------------------------------------------------
// Fraud Trend (12 weeks)
// ---------------------------------------------------------------------------

export const MOCK_FRAUD_TREND: FraudTrendPoint[] = [
  { date: "2026-03-16", alerts: 18, confirmed: 4, dismissed: 7 },
  { date: "2026-03-23", alerts: 22, confirmed: 6, dismissed: 9 },
  { date: "2026-03-30", alerts: 19, confirmed: 5, dismissed: 8 },
  { date: "2026-04-06", alerts: 27, confirmed: 8, dismissed: 10 },
  { date: "2026-04-13", alerts: 31, confirmed: 10, dismissed: 11 },
  { date: "2026-04-20", alerts: 24, confirmed: 7, dismissed: 9 },
  { date: "2026-04-27", alerts: 35, confirmed: 14, dismissed: 8 },
  { date: "2026-05-04", alerts: 41, confirmed: 17, dismissed: 12 },
  { date: "2026-05-11", alerts: 38, confirmed: 15, dismissed: 11 },
  { date: "2026-05-18", alerts: 44, confirmed: 18, dismissed: 14 },
  { date: "2026-05-25", alerts: 52, confirmed: 22, dismissed: 15 },
  { date: "2026-06-01", alerts: 61, confirmed: 27, dismissed: 17 },
  { date: "2026-06-08", alerts: 58, confirmed: 24, dismissed: 19 },
];

// ---------------------------------------------------------------------------
// Risk Distribution
// ---------------------------------------------------------------------------

export const MOCK_RISK_DISTRIBUTION: RiskDistribution[] = [
  { level: RiskLevel.LOW, count: 1204, pct: 65.4 },
  { level: RiskLevel.MODERATE, count: 382, pct: 20.7 },
  { level: RiskLevel.HIGH, count: 198, pct: 10.8 },
  { level: RiskLevel.CRITICAL, count: 58, pct: 3.1 },
];

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const MOCK_REPORTS: Report[] = [
  {
    id: "rpt-001",
    organizationId: "org-001",
    type: ReportType.FRAUD_SUMMARY,
    format: ReportFormat.PDF,
    status: ReportStatus.READY,
    parameters: { startDate: "2026-05-01", endDate: "2026-05-31" },
    requestedById: "user-001",
    expiresAt: "2026-07-10T00:00:00Z",
    createdAt: "2026-06-01T09:00:00Z",
    completedAt: "2026-06-01T09:04:12Z",
    requestedBy: MOCK_USERS[0],
  },
  {
    id: "rpt-002",
    organizationId: "org-001",
    type: ReportType.PROVIDER_RISK,
    format: ReportFormat.XLSX,
    status: ReportStatus.READY,
    parameters: { asOf: "2026-06-09" },
    requestedById: "user-002",
    expiresAt: "2026-07-10T00:00:00Z",
    createdAt: "2026-06-09T17:00:00Z",
    completedAt: "2026-06-09T17:02:45Z",
    requestedBy: MOCK_USERS[1],
  },
  {
    id: "rpt-003",
    organizationId: "org-001",
    type: ReportType.VISIT_VERIFICATION,
    format: ReportFormat.PDF,
    status: ReportStatus.GENERATING,
    parameters: { startDate: "2026-06-01", endDate: "2026-06-10" },
    requestedById: "user-003",
    createdAt: "2026-06-10T09:30:00Z",
    requestedBy: MOCK_USERS[2],
  },
  {
    id: "rpt-004",
    organizationId: "org-001",
    type: ReportType.STATE_COMPLIANCE,
    format: ReportFormat.PDF,
    status: ReportStatus.READY,
    parameters: { quarter: "Q1-2026" },
    requestedById: "user-003",
    expiresAt: "2026-07-01T00:00:00Z",
    createdAt: "2026-04-05T10:00:00Z",
    completedAt: "2026-04-05T10:18:30Z",
    requestedBy: MOCK_USERS[2],
  },
  {
    id: "rpt-005",
    organizationId: "org-001",
    type: ReportType.INVESTIGATION,
    format: ReportFormat.PDF,
    status: ReportStatus.FAILED,
    parameters: { caseId: "case-001" },
    requestedById: "user-001",
    createdAt: "2026-06-08T14:00:00Z",
    requestedBy: MOCK_USERS[0],
  },
];

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: "al-001",
    organizationId: "org-001",
    actorId: "user-001",
    action: AuditAction.READ,
    resourceType: "fraud_case",
    resourceId: "case-001",
    ipAddress: "10.14.2.88",
    metadata: { caseNumber: "RV-2026-000041" },
    createdAt: "2026-06-10T09:45:00Z",
    actor: MOCK_USERS[0],
  },
  {
    id: "al-002",
    organizationId: "org-001",
    actorId: "user-001",
    action: AuditAction.CASE_ACTION,
    resourceType: "fraud_case",
    resourceId: "case-001",
    ipAddress: "10.14.2.88",
    metadata: { action: "ESCALATE", previousStatus: "IN_REVIEW", newStatus: "ESCALATED" },
    createdAt: "2026-06-10T09:42:00Z",
    actor: MOCK_USERS[0],
  },
  {
    id: "al-003",
    organizationId: "org-001",
    actorId: "user-002",
    action: AuditAction.EXPORT,
    resourceType: "report",
    resourceId: "rpt-001",
    ipAddress: "10.14.2.91",
    metadata: { format: "PDF", size: "1.2 MB" },
    createdAt: "2026-06-10T09:30:00Z",
    actor: MOCK_USERS[1],
  },
  {
    id: "al-004",
    organizationId: "org-001",
    actorId: "user-004",
    action: AuditAction.UPDATE,
    resourceType: "fraud_event",
    resourceId: "fe-001",
    ipAddress: "10.14.2.105",
    metadata: { previousStatus: "OPEN", newStatus: "CONFIRMED" },
    createdAt: "2026-06-10T09:15:00Z",
    actor: MOCK_USERS[3],
  },
  {
    id: "al-005",
    organizationId: "org-001",
    actorId: "user-003",
    action: AuditAction.LOGIN,
    resourceType: "session",
    ipAddress: "10.14.2.77",
    metadata: { mfaMethod: "TOTP" },
    createdAt: "2026-06-10T07:01:00Z",
    actor: MOCK_USERS[2],
  },
  {
    id: "al-006",
    organizationId: "org-001",
    actorId: "user-001",
    action: AuditAction.VERIFY,
    resourceType: "visit",
    resourceId: "v-003",
    ipAddress: "10.14.2.88",
    metadata: { verificationResult: "PASS", riskScore: 11 },
    createdAt: "2026-06-10T07:01:30Z",
    actor: MOCK_USERS[0],
  },
  {
    id: "al-007",
    organizationId: "org-001",
    actorId: "user-004",
    action: AuditAction.SCORE,
    resourceType: "provider",
    resourceId: "prov-001",
    ipAddress: "10.14.2.105",
    metadata: { previousScore: 82, newScore: 87, riskLevel: "CRITICAL" },
    createdAt: "2026-06-10T06:00:00Z",
    actor: MOCK_USERS[3],
  },
  {
    id: "al-008",
    organizationId: "org-001",
    actorId: "user-002",
    action: AuditAction.CREATE,
    resourceType: "fraud_case",
    resourceId: "case-004",
    ipAddress: "10.14.2.91",
    metadata: { caseNumber: "RV-2026-000051", priority: "URGENT" },
    createdAt: "2026-06-05T11:01:00Z",
    actor: MOCK_USERS[1],
  },
  {
    id: "al-009",
    organizationId: "org-001",
    actorId: "user-001",
    action: AuditAction.READ,
    resourceType: "visit",
    resourceId: "v-001",
    ipAddress: "10.14.2.88",
    metadata: {},
    createdAt: "2026-06-05T10:55:00Z",
    actor: MOCK_USERS[0],
  },
  {
    id: "al-010",
    organizationId: "org-001",
    actorId: "user-003",
    action: AuditAction.CONFIG_CHANGE,
    resourceType: "organization",
    resourceId: "org-001",
    ipAddress: "10.14.2.77",
    metadata: { field: "gpsThresholdMeters", from: 200, to: 150 },
    createdAt: "2026-06-04T14:20:00Z",
    actor: MOCK_USERS[2],
  },
];
