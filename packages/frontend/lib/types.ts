// =============================================================================
// RayVerify™ — Frontend TypeScript types
// Mirrors the Prisma schema enums and core entities.
// =============================================================================

// ---------------------------------------------------------------------------
// Enums (mirror prisma schema)
// ---------------------------------------------------------------------------

export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
  LOCKED = "LOCKED",
  PENDING_INVITE = "PENDING_INVITE",
}

export enum VerificationResult {
  PASS = "PASS",
  REVIEW = "REVIEW",
  FAIL = "FAIL",
}

export enum RiskLevel {
  LOW = "LOW",
  MODERATE = "MODERATE",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum VisitStatus {
  SCHEDULED = "SCHEDULED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FLAGGED = "FLAGGED",
  REJECTED = "REJECTED",
  APPROVED = "APPROVED",
  CANCELLED = "CANCELLED",
}

export enum FraudEventType {
  IMPOSSIBLE_TRAVEL = "IMPOSSIBLE_TRAVEL",
  DUPLICATE_VISIT = "DUPLICATE_VISIT",
  SHARED_DEVICE = "SHARED_DEVICE",
  GPS_ANOMALY = "GPS_ANOMALY",
  IDENTITY_MISMATCH = "IDENTITY_MISMATCH",
  UNUSUAL_BILLING = "UNUSUAL_BILLING",
  ABNORMAL_DURATION = "ABNORMAL_DURATION",
  EXCESSIVE_OVERTIME = "EXCESSIVE_OVERTIME",
  SERVICE_OVERLAP = "SERVICE_OVERLAP",
  CROSS_PROVIDER_RISK = "CROSS_PROVIDER_RISK",
  LIVENESS_FAILURE = "LIVENESS_FAILURE",
  DEVICE_TAMPERING = "DEVICE_TAMPERING",
  GEOFENCE_BREACH = "GEOFENCE_BREACH",
}

export enum FraudEventStatus {
  OPEN = "OPEN",
  TRIAGED = "TRIAGED",
  LINKED_TO_CASE = "LINKED_TO_CASE",
  DISMISSED = "DISMISSED",
  CONFIRMED = "CONFIRMED",
}

export enum CaseStatus {
  OPEN = "OPEN",
  IN_REVIEW = "IN_REVIEW",
  ESCALATED = "ESCALATED",
  PENDING_PAYMENT_HOLD = "PENDING_PAYMENT_HOLD",
  SUBSTANTIATED = "SUBSTANTIATED",
  UNSUBSTANTIATED = "UNSUBSTANTIATED",
  CLOSED = "CLOSED",
}

export enum CasePriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum DeviceTrustLevel {
  TRUSTED = "TRUSTED",
  UNKNOWN = "UNKNOWN",
  SUSPICIOUS = "SUSPICIOUS",
  BLOCKED = "BLOCKED",
}

export enum DevicePlatform {
  IOS = "IOS",
  ANDROID = "ANDROID",
  WEB = "WEB",
  HARDWARE_TERMINAL = "HARDWARE_TERMINAL",
}

export enum IdentityMethod {
  SELFIE = "SELFIE",
  LIVENESS = "LIVENESS",
  DEVICE_TRUST = "DEVICE_TRUST",
  FINGERPRINT = "FINGERPRINT",
  NFC_CARD = "NFC_CARD",
  GOV_CREDENTIAL = "GOV_CREDENTIAL",
}

export enum ReportType {
  FRAUD_SUMMARY = "FRAUD_SUMMARY",
  PROVIDER_RISK = "PROVIDER_RISK",
  VISIT_VERIFICATION = "VISIT_VERIFICATION",
  INVESTIGATION = "INVESTIGATION",
  STATE_COMPLIANCE = "STATE_COMPLIANCE",
  EXECUTIVE_DASHBOARD = "EXECUTIVE_DASHBOARD",
}

export enum ReportFormat {
  PDF = "PDF",
  XLSX = "XLSX",
  CSV = "CSV",
  JSON = "JSON",
}

export enum ReportStatus {
  QUEUED = "QUEUED",
  GENERATING = "GENERATING",
  READY = "READY",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
}

export enum AuditAction {
  CREATE = "CREATE",
  READ = "READ",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  EXPORT = "EXPORT",
  VERIFY = "VERIFY",
  SCORE = "SCORE",
  CASE_ACTION = "CASE_ACTION",
  CONFIG_CHANGE = "CONFIG_CHANGE",
}

// ---------------------------------------------------------------------------
// Entity types
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  jurisdiction?: string;
  isActive: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: UserStatus;
  lastLoginAt?: string;
  createdAt: string;
  roles?: string[];
}

export interface Provider {
  id: string;
  organizationId: string;
  npi?: string;
  medicaidId?: string;
  legalName: string;
  isActive: boolean;
  enrolledAt: string;
  riskProfile?: ProviderRiskProfile;
}

export interface Caregiver {
  id: string;
  organizationId: string;
  providerId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status: UserStatus;
}

export interface Patient {
  id: string;
  organizationId: string;
  medicaidMemberId?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
}

export interface Visit {
  id: string;
  organizationId: string;
  providerId: string;
  caregiverId: string;
  patientId: string;
  serviceCode?: string;
  status: VisitStatus;
  scheduledStart: string;
  scheduledEnd?: string;
  clockInAt?: string;
  clockOutAt?: string;
  durationMinutes?: number;
  clockInLat?: number;
  clockInLng?: number;
  billedAmountCents?: number;
  verificationResult?: VerificationResult;
  riskScore?: number;
  riskLevel?: RiskLevel;
  createdAt: string;
  // Joined
  provider?: Provider;
  caregiver?: Caregiver;
  patient?: Patient;
  visitVerification?: VisitVerification;
}

export interface VisitVerification {
  id: string;
  visitId: string;
  result: VerificationResult;
  riskScore: number;
  riskLevel: RiskLevel;
  chain: VerificationChain;
  evidenceHash?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface VerificationChainStep {
  step: "identity" | "gps" | "device" | "patient" | "fraud";
  result: VerificationResult;
  score?: number;
  label: string;
  details?: string;
  method?: string;
  timestamp: string;
}

export interface VerificationChain {
  identity?: VerificationChainStep;
  gps?: VerificationChainStep;
  device?: VerificationChainStep;
  patient?: VerificationChainStep;
  fraud?: VerificationChainStep;
}

export interface FraudEvent {
  id: string;
  organizationId: string;
  visitId?: string;
  caseId?: string;
  type: FraudEventType;
  status: FraudEventStatus;
  severity: number;
  riskLevel: RiskLevel;
  explanation?: string;
  detector?: string;
  detectedAt: string;
}

export interface FraudCase {
  id: string;
  organizationId: string;
  caseNumber: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  riskLevel: RiskLevel;
  providerId?: string;
  assigneeId?: string;
  exposureCents?: number;
  summary?: string;
  openedAt: string;
  closedAt?: string;
  updatedAt: string;
  // Joined
  provider?: Provider;
  assignee?: User;
  events?: FraudEvent[];
  notes?: CaseNote[];
  evidence?: CaseEvidence[];
}

export interface CaseNote {
  id: string;
  caseId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author?: User;
}

export interface CaseEvidence {
  id: string;
  caseId: string;
  label: string;
  kind: string;
  refId?: string;
  contentHash?: string;
  createdAt: string;
}

export interface ProviderRiskProfile {
  id: string;
  organizationId: string;
  providerId: string;
  currentScore: number;
  riskLevel: RiskLevel;
  verificationFailures: number;
  gpsAnomalies: number;
  billingAnomalies: number;
  identityIssues: number;
  openCases: number;
  substantiatedCases: number;
  trend: TrendPoint[];
  lastComputedAt: string;
  provider?: Provider;
}

export interface TrendPoint {
  t: string;
  score: number;
}

export interface Report {
  id: string;
  organizationId: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  parameters: Record<string, unknown>;
  requestedById?: string;
  expiresAt?: string;
  createdAt: string;
  completedAt?: string;
  requestedBy?: User;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  actorId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, unknown>;
  prevHash?: string;
  hash?: string;
  createdAt: string;
  actor?: User;
}

// ---------------------------------------------------------------------------
// Dashboard / aggregated DTOs
// ---------------------------------------------------------------------------

export interface OverviewStats {
  openCases: number;
  criticalAlerts: number;
  dollarAtRiskCents: number;
  visitsVerifiedToday: number;
  falsePositiveRate: number;
  visitsVerifiedChange: number;
  openCasesChange: number;
  criticalAlertsChange: number;
}

export interface FraudTrendPoint {
  date: string;
  alerts: number;
  confirmed: number;
  dismissed: number;
}

export interface RiskDistribution {
  level: RiskLevel;
  count: number;
  pct: number;
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  organization: Organization;
}
