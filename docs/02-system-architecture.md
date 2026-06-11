# RayVerify™ — System Architecture

> **Document:** 02 — System Architecture
> **Platform:** RayVerify™ (parent: RayHealthEVV™)
> **Audience:** Engineering leadership, government evaluators, technical investors
> **Status:** Approved for distribution

---

## Table of Contents

1. [Architecture Principles](#1-architecture-principles)
2. [C4-Style Context & Container Diagrams](#2-c4-style-context--container-diagrams)
3. [Logical Service Decomposition](#3-logical-service-decomposition)
4. [Key Runtime Flows](#4-key-runtime-flows)
5. [Data Flow & Storage Tiers](#5-data-flow--storage-tiers)
6. [Multi-Tenancy Model](#6-multi-tenancy-model)
7. [Integration Architecture](#7-integration-architecture)
8. [Scalability, Resilience & Failure Modes](#8-scalability-resilience--failure-modes)

---

## 1. Architecture Principles

RayVerify is built on six foundational principles that govern every design decision from the data layer to the API surface.

### 1.1 API-First

Every capability is exposed through a versioned REST API (`/v1/...`) with an OpenAPI 3.1 contract as the source of truth. No internal shortcut bypasses the API contract. This enables:

- Clients (dashboard, EVV capture app, state integrations) to evolve independently of the backend.
- Government evaluators to audit the full system behavior through a stable, documented contract.
- Future frontend and mobile clients to be built without back-end changes.

### 1.2 Multi-Tenant by Design

Every business table carries an `organization_id` column. PostgreSQL Row-Level Security (RLS) policies enforced at the database layer — not just the application layer — make it impossible for one tenant's queries to read or write another tenant's data, even under application bugs or SQL injection. See §6 for the full tenancy model.

### 1.3 Microservice-Ready Modular Monolith

The initial deployment is a **modular monolith**: a single NestJS process with clean module boundaries (auth, identity, visits, verification, fraud, cases, providers, reporting, audit, notifications). Each module:

- Has a dedicated NestJS module class with its own providers and no direct imports from sibling modules (all cross-module interaction via injected service interfaces).
- Owns its own Prisma query scope.
- Emits and consumes domain events via an internal event bus (NestJS `EventEmitter2`), which is a drop-in replacement target for NATS/Kafka when extracted to microservices.

This path is described in §3.

### 1.4 Zero-Trust Security

- Every inbound request carries a short-lived JWT (15 min). Refresh tokens are SHA-256-hashed before storage; raw values never persist.
- MFA is enforced for investigator and admin roles (TOTP, SMS, WebAuthn).
- Internal service-to-service calls use the same JWT validation (no trusted network assumption).
- PHI columns are AES-256-GCM encrypted at the application layer before being written to PostgreSQL; AWS KMS manages the envelope keys.
- Infrastructure is deployed in a private VPC; only the ALB/CloudFront edge accepts public traffic.

### 1.5 Event-Driven Where It Matters

Fraud detection and report generation are decoupled from the synchronous request path via Redis-backed BullMQ queues. This gives:

- Predictable API latency for caregiver-facing clock-in/out (< 500 ms p99), even when fraud scoring involves multiple ML detectors.
- Horizontal worker scaling independent of the API tier.
- Durable, retry-able jobs with dead-letter queues and exactly-once semantics via job IDs derived from visit UUIDs.

### 1.6 Defense-in-Depth & Append-Only Evidence

Evidence integrity is not an afterthought. The schema enforces it at the database layer:

- `identity_verifications`, `gps_verifications`, `device_verifications`, and `fraud_events` are **append-only** — PostgreSQL triggers (`trg_*_immutable`) reject any `UPDATE` or `DELETE` with error code `integrity_constraint_violation`.
- `audit_logs` is append-only **and** maintains a SHA-256 tamper-evident hash chain (each row's `hash` covers `prev_hash || row_fields`).
- `visit_verifications` carries an `evidence_hash` (SHA-256 over the canonical evidence package) stored at the moment the verification chain closes.

---

## 2. C4-Style Context & Container Diagrams

### 2.1 System Context

```mermaid
C4Context
  title RayVerify™ — System Context

  Person(investigator, "Investigator / Auditor", "Reviews fraud alerts, manages cases, exports compliance reports. Uses the Investigator Dashboard (web).")
  Person(caregiver, "Caregiver", "Clocks in/out of visits using the Field/EVV Capture App (mobile).")
  Person(stateAnalyst, "State / MCO Analyst", "Queries APIs and receives scheduled compliance exports.")

  System(rayverify, "RayVerify™", "Fraud detection, identity verification, visit verification, case management, and compliance reporting for Medicaid/HCBS programs.")

  System_Ext(biometricVendor, "Biometric / Liveness Vendor", "Face-match & liveness API (e.g. AWS Rekognition or third-party). Returns confidence scores.")
  System_Ext(kms, "AWS KMS", "Envelope key management for AES-256-GCM encryption of PHI columns and biometric evidence objects.")
  System_Ext(s3, "AWS S3", "Encrypted object storage for biometric probe images, report files, and case evidence exports.")
  System_Ext(notifProvider, "Notification Providers", "Email (SES), SMS (SNS/Twilio), webhook endpoints for fraud alerts and case events.")
  System_Ext(stateEVV, "State EVV / MMIS System", "Upstream source-of-truth for service authorizations and billing claims (batch or webhook).")
  System_Ext(cloudfront, "AWS CloudFront / WAF", "CDN edge with WAF rules; terminates TLS, rate-limits, and shields origin.")

  Rel(investigator, rayverify, "Investigates fraud, reviews cases, exports reports", "HTTPS / REST API")
  Rel(caregiver, rayverify, "Clocks in/out, submits identity & GPS evidence", "HTTPS / REST API (mobile)")
  Rel(stateAnalyst, rayverify, "Queries reporting API; receives scheduled exports", "HTTPS / REST API")
  Rel(rayverify, biometricVendor, "Submits selfie + reference; receives confidence", "HTTPS (mTLS)")
  Rel(rayverify, kms, "Encrypt / decrypt data keys for PHI", "AWS SDK")
  Rel(rayverify, s3, "Store & retrieve encrypted evidence objects", "AWS SDK")
  Rel(rayverify, notifProvider, "Dispatch fraud alerts, case notifications", "HTTPS / SMTP / SMS")
  Rel(stateEVV, rayverify, "Push service authorizations, visit claims", "Batch SFTP / Webhook")
  Rel(cloudfront, rayverify, "Proxy inbound requests; WAF filtering", "HTTPS (private ALB)")
```

### 2.2 Container Diagram

```mermaid
C4Container
  title RayVerify™ — Containers

  Person(user, "Dashboard / Mobile / Integration User")

  System_Boundary(rayverify, "RayVerify™ Platform") {
    Container(cdn, "CloudFront + WAF", "AWS CloudFront", "TLS termination, WAF, DDoS protection, CDN for static assets.")
    Container(dashboard, "Investigator Dashboard", "Next.js 15 / TS / Tailwind / shadcn", "SPA served from CloudFront; communicates exclusively with the API Gateway.")
    Container(api, "API Gateway / Core NestJS", "NestJS 10 / TypeScript", "Single entry point: JWT auth, request validation, rate-limiting, module routing. Hosts all 10 NestJS service modules.")
    Container(workerFraud, "Fraud Detection Workers", "NestJS / BullMQ worker processes", "Async consumers of the fraud-detection queue; run detectors, write fraud_events, update fraud_scores and provider_risk_profiles.")
    Container(workerReport, "Report Generation Workers", "NestJS / BullMQ worker processes", "Consume report-generation queue; query DB, render PDF/XLSX/CSV, upload to S3, update reports.status.")
    Container(pg, "PostgreSQL 15+", "AWS RDS Multi-AZ", "Primary OLTP store. RLS-enforced multi-tenancy. Partitioned visits and audit_logs. Append-only evidence tables.")
    Container(redis, "Redis 7", "AWS ElastiCache (cluster mode)", "BullMQ job queues (fraud-detection, report-generation, notifications). API response cache (tenant-scoped keys). Session blacklist.")
    Container(s3store, "S3 Encrypted Object Store", "AWS S3 (SSE-KMS)", "Biometric probe images, visit evidence packages, report files, case evidence exports. Lifecycle policies enforce retention limits.")
    Container(pgReplica, "PostgreSQL Read Replica(s)", "AWS RDS Read Replica", "Offload heavy reporting queries and provider risk dashboards.")
  }

  System_Ext(kms, "AWS KMS", "Envelope key management")
  System_Ext(biometricVendor, "Biometric / Liveness API")
  System_Ext(notifProvider, "Email / SMS / Webhook Providers")
  System_Ext(stateEVV, "State EVV / MMIS")

  Rel(user, cdn, "HTTPS")
  Rel(cdn, dashboard, "Serve static assets")
  Rel(cdn, api, "Proxy API calls", "HTTPS → private ALB")
  Rel(dashboard, api, "REST API", "JWT Bearer")
  Rel(api, pg, "Prisma ORM reads/writes", "TCP 5432")
  Rel(api, pgReplica, "Read-heavy queries (reports, risk dashboards)", "TCP 5432")
  Rel(api, redis, "Enqueue jobs, cache, session ops", "TCP 6379")
  Rel(api, s3store, "PUT encrypted objects", "AWS SDK")
  Rel(api, kms, "Encrypt/decrypt PHI data keys", "AWS SDK")
  Rel(api, biometricVendor, "Identity verification calls", "HTTPS")
  Rel(api, notifProvider, "Send notifications", "HTTPS")
  Rel(workerFraud, redis, "Dequeue fraud jobs", "BullMQ")
  Rel(workerFraud, pg, "Read visit evidence, write fraud_events / fraud_scores", "TCP 5432")
  Rel(workerReport, redis, "Dequeue report jobs", "BullMQ")
  Rel(workerReport, pgReplica, "Execute reporting queries", "TCP 5432")
  Rel(workerReport, s3store, "Upload completed report files", "AWS SDK")
  Rel(stateEVV, api, "POST authorizations, visit claims", "HTTPS / Batch")
```

---

## 3. Logical Service Decomposition

### 3.1 NestJS Module Map

The backend is a single NestJS application (`packages/backend/src`) composed of the following modules. Each module is independently testable and has no compile-time circular dependencies on siblings.

```mermaid
flowchart TD
  subgraph Core
    AppModule --> AuthModule
    AppModule --> CommonModule
    AppModule --> PrismaModule
  end

  subgraph Platform_Modules["Platform Modules (the 8 product modules)"]
    direction TB
    M1[IdentityModule\nIdentity Verification Engine]
    M2[VisitsModule\nVisit Verification Engine]
    M3[FraudModule\nFraud Intelligence Engine]
    M4[CasesModule\nInvestigator Dashboard]
    M5[ProvidersModule\nProvider Risk Scoring]
    M6[AuditModule\nAudit & Compliance Center]
    M7[ReportingModule\nReporting & Analytics]
    M8[HardwareModule\nFuture Hardware Integration Layer]
  end

  subgraph Supporting_Modules["Supporting Modules"]
    M9[NotificationsModule]
    M10[PatientsModule]
    M11[CaregiversModule]
  end

  AppModule --> M1 & M2 & M3 & M4 & M5 & M6 & M7 & M8 & M9 & M10 & M11

  M2 -->|"IdentityService (interface)"| M1
  M2 -->|"FraudQueueService"| M3
  M3 -->|"CaseService (interface)"| M4
  M3 -->|"ProviderRiskService"| M5
  M4 -->|"NotificationService"| M9
  M7 -->|"AuditService"| M6
  M6 -->|"S3Service (common)"| CommonModule
```

### 3.2 Module-to-Schema Responsibility

| NestJS Module | Tables Owned (write authority) | Tables Read |
|---|---|---|
| `AuthModule` | `users`, `sessions`, `user_roles` | `roles`, `permissions`, `role_permissions` |
| `IdentityModule` | `identity_verifications`, `biometric_enrollments` | `caregivers`, `devices` |
| `VisitsModule` | `visits`, `visit_verifications` | `caregivers`, `patients`, `service_authorizations`, `devices` |
| `FraudModule` | `fraud_events`, `fraud_scores` | `visits`, all verification tables |
| `CasesModule` | `fraud_cases`, `case_notes`, `case_evidence` | `fraud_events`, `providers`, `users` |
| `ProvidersModule` | `providers`, `provider_risk_profiles` | `fraud_events`, `fraud_scores`, `visits` |
| `AuditModule` | `audit_logs` | `audit_logs` (read-only exports) |
| `ReportingModule` | `reports` | all (read replica) |
| `NotificationsModule` | `notifications` | `users`, `fraud_cases` |
| `PatientsModule` | `patients` | `visits`, `service_authorizations` |
| `CaregiversModule` | `caregivers` | `visits`, `identity_verifications` |

### 3.3 Modular-Monolith Now / Microservice Later

```mermaid
flowchart LR
  subgraph Phase1["Phase 1 — Modular Monolith (current)"]
    NestApp["Single NestJS process\nAll modules co-located\nEventEmitter2 internal bus\nShared Prisma client\nShared Redis client"]
  end

  subgraph Phase2["Phase 2 — Extract High-Load Services"]
    API2["API Gateway\n(auth + routing)"]
    FraudSvc["Fraud Detection\nMicroservice"]
    ReportSvc["Report Generation\nMicroservice"]
    CoreSvc["Core Domain Service\n(visits, cases, identity)"]
  end

  subgraph Phase3["Phase 3 — Full Microservices (optional)"]
    Each["Each product module\nas independent service\nNATS / Kafka event bus\nService mesh (Istio)"]
  end

  Phase1 -->|"Replace EventEmitter2\nwith NATS transport"| Phase2
  Phase2 -->|"Decompose remaining\nmodules on demand"| Phase3
```

The transition from Phase 1 to Phase 2 requires only:
1. Replacing `EventEmitter2` emissions with `@nestjs/microservices` NATS client calls.
2. Extracting worker processes (already separate in Phase 1) into their own ECS task definitions.
3. No database schema changes — the RLS boundary already enforces isolation.

---

## 4. Key Runtime Flows

### 4.1 Full Visit Verification Chain

This is the primary integrity-critical flow. It runs synchronously within the API request for the clock-out event, writing append-only evidence at every step.

```mermaid
sequenceDiagram
  autonumber
  actor CG as Caregiver App
  participant API as NestJS API
  participant IDV as IdentityModule
  participant VIS as VisitsModule
  participant GPS as GpsService
  participant DEV as DeviceService
  participant BIO as Biometric Vendor
  participant S3 as S3 (encrypted)
  participant DB as PostgreSQL
  participant Q as Redis / BullMQ

  CG->>API: POST /v1/visits/{id}/clock-out\n{ selfie_b64, gps_coords, device_signals, patient_confirm }
  API->>API: Validate JWT, extract org_id tenant context\nSET app.current_org = org_id (RLS GUC)

  note over API,DB: Step 1 — Identity Verification
  API->>IDV: verifyIdentity(caregiverId, selfieB64, visitId)
  IDV->>S3: PUT probe_image (AES-256-GCM, KMS key)
  IDV->>BIO: faceMatch(probe_s3_key, reference_template_ref)
  BIO-->>IDV: { confidence: 0.97, liveness: 0.99, result: "PASS" }
  IDV->>DB: INSERT identity_verifications (append-only)\n{ result: PASS, confidence_score, liveness_score, probe_s3_key }
  IDV-->>API: IdentityResult { result: PASS, confidenceScore: 0.97 }

  note over API,DB: Step 2 — GPS Verification
  API->>GPS: verifyGps(visitId, coords, authorizationId)
  GPS->>DB: SELECT service_authorizations (lat/lng/radius_meters)
  GPS->>GPS: haversineDistance(captured, authorized)\nvs radius_meters threshold
  GPS->>DB: INSERT gps_verifications (append-only)\n{ latitude, longitude, distance_meters, result: PASS }
  GPS-->>API: GpsResult { result: PASS, distanceMeters: 42 }

  note over API,DB: Step 3 — Device Verification
  API->>DEV: verifyDevice(deviceId, signals, visitId)
  DEV->>DEV: Evaluate emulator / root / jailbreak / fingerprint signals
  DEV->>DB: INSERT device_verifications (append-only)\n{ result, trust_level, signals }
  DEV->>DB: UPDATE devices SET trust_level, last_seen_at
  DEV-->>API: DeviceResult { result: PASS, trustLevel: TRUSTED }

  note over API,DB: Step 4 — Patient Confirmation (record only)
  API->>DB: UPDATE visits SET patient_confirmed_at (if patient_confirm=true)

  note over API,DB: Step 5 — Composite Verification Decision
  API->>VIS: buildVerificationChain(identity, gps, device, patientConfirm)
  VIS->>VIS: Aggregate results → composite VerificationResult\ncompute preliminary risk_score (0–100)
  VIS->>DB: INSERT visit_verifications\n{ result, risk_score, risk_level, chain (JSON), evidence_hash }
  VIS->>DB: UPDATE visits SET verification_result, risk_score, risk_level, clock_out_at, status=COMPLETED

  note over API,Q: Step 6 — Async Fraud Scoring (non-blocking)
  API->>Q: ENQUEUE fraud-detection job\n{ visitId, orgId, jobId=hash(visitId) }
  Q-->>API: jobId acknowledged

  API-->>CG: 200 OK { verificationResult: "PASS", riskScore: 12, riskLevel: "LOW" }

  note over Q,DB: Async — Fraud Intelligence Engine (see §4.2)
  Q->>Q: Worker picks up fraud-detection job
```

### 4.2 Async Fraud Detection Pipeline

```mermaid
sequenceDiagram
  autonumber
  participant Q as Redis / BullMQ
  participant FW as Fraud Worker
  participant DB as PostgreSQL
  participant FRAUD as FraudModule\n(Detector Chain)
  participant CASES as CasesModule
  participant NOTIF as NotificationsModule

  Q->>FW: Dequeue fraud-detection job { visitId, orgId }
  FW->>DB: SELECT visit + caregiverId + providerId + history\n(last 30 days visits for caregiver/patient/provider)
  DB-->>FW: Visit context + history rows

  FW->>FRAUD: runDetectors(visitContext)

  par Detector: Impossible Travel
    FRAUD->>DB: SELECT prior visit clock_out_at + clock_in_lat/lng\nfor same caregiver in last 4 hours
    FRAUD->>FRAUD: haversineSpeed > threshold? → IMPOSSIBLE_TRAVEL event
  and Detector: Duplicate Visit
    FRAUD->>DB: SELECT visits WHERE caregiver_id AND same time window
    FRAUD->>FRAUD: overlap > 0 min? → DUPLICATE_VISIT event
  and Detector: GPS Anomaly
    FRAUD->>DB: SELECT gps_verifications for visit
    FRAUD->>FRAUD: distance_meters > radius + anomaly_buffer? → GPS_ANOMALY event
  and Detector: Shared Device
    FRAUD->>DB: SELECT visits with same device_id in overlapping window
    FRAUD->>FRAUD: Multiple caregivers? → SHARED_DEVICE event
  and Detector: Billing Anomaly
    FRAUD->>DB: SELECT authorized_units vs billed_units for patient
    FRAUD->>FRAUD: Over-billing? → UNUSUAL_BILLING event
  end

  FRAUD->>DB: INSERT fraud_events[] (append-only, one row per triggered detector)
  FRAUD->>FRAUD: compositeScore = weightedSum(severity[]) clamped 0–100
  FRAUD->>DB: INSERT fraud_scores { subjectType: VISIT, score, risk_level, factors }
  FRAUD->>DB: UPDATE visits SET risk_score, risk_level, status=FLAGGED (if score > threshold)

  alt score >= 61 (HIGH / CRITICAL)
    FRAUD->>CASES: autoCreateOrLinkCase(providerId, fraudEvents[])
    CASES->>DB: INSERT fraud_cases (if no open case for provider)
    CASES->>DB: UPDATE fraud_events SET case_id, status=LINKED_TO_CASE
    CASES->>NOTIF: dispatchAlert(assigneeId, caseId, riskLevel)
    NOTIF->>DB: INSERT notifications
  end

  FRAUD->>DB: UPDATE provider_risk_profiles\n(current_score, counters, trend sparkline)
  FW->>Q: JOB COMPLETE (BullMQ marks done)
```

### 4.3 Report Generation Job

```mermaid
sequenceDiagram
  autonumber
  actor INV as Investigator
  participant API as NestJS API
  participant DB as PostgreSQL
  participant Q as Redis / BullMQ
  participant RW as Report Worker
  participant PGRO as PostgreSQL\nRead Replica
  participant S3 as S3 (encrypted)
  participant NOTIF as NotificationsModule

  INV->>API: POST /v1/reports\n{ type: FRAUD_SUMMARY, format: PDF, parameters: { dateRange, orgId } }
  API->>DB: INSERT reports { status: QUEUED, parameters }
  API->>Q: ENQUEUE report-generation job { reportId }
  API-->>INV: 202 Accepted { reportId, status: "QUEUED" }

  Q->>RW: Dequeue report job { reportId }
  RW->>DB: UPDATE reports SET status=GENERATING
  RW->>PGRO: Execute parameterized report query\n(fraud summaries, provider risk, visit stats — read replica)
  PGRO-->>RW: Result rows
  RW->>RW: Render PDF / XLSX / CSV using template engine
  RW->>S3: PUT report file (SSE-KMS), returns s3_key
  RW->>DB: UPDATE reports SET status=READY, s3_key, completed_at, expires_at=now()+7d
  RW->>NOTIF: dispatchReportReady(requestedById, reportId)
  NOTIF->>DB: INSERT notifications

  INV->>API: GET /v1/reports/{reportId}/download
  API->>DB: SELECT reports WHERE id AND status=READY
  API->>S3: GeneratePresignedUrl (15 min TTL)
  API-->>INV: 302 redirect → presigned S3 URL
  API->>DB: INSERT audit_logs { action: EXPORT, resourceType: report }
```

---

## 5. Data Flow & Storage Tiers

```mermaid
flowchart TD
  subgraph Ingest["Ingest Paths"]
    CAP[Field Capture App\nclock-in / clock-out]
    API_IN[REST API Ingest\n/v1/visits, /v1/authorizations]
    BATCH[State SFTP Batch\nauthorizations / claims]
  end

  subgraph Hot["Hot Tier — PostgreSQL (RDS Multi-AZ)"]
    direction TB
    VISITS[(visits\npartitioned monthly)]
    VERIF[(verification chain\nidentity / gps / device\nappend-only)]
    FRAUD_T[(fraud_events\nfraud_scores\nfraud_cases)]
    RISK[(provider_risk_profiles\nhot denormalized)]
    AUDIT[(audit_logs\npartitioned monthly\nhash chain)]
    USERS_T[(organizations / users\nroles / permissions)]
  end

  subgraph Warm["Warm Tier — Redis (ElastiCache)"]
    QUEUES[BullMQ Queues\nfraud-detection\nreport-generation\nnotifications]
    CACHE[API Response Cache\ntenant-scoped keys\nTTL 60–300 s]
    SESS[Session Blacklist\nrevoked refresh tokens]
  end

  subgraph Cold["Cold / Evidence Tier — S3 (SSE-KMS)"]
    PROBES[Biometric Probe Images\nPHI — AES-256-GCM\nLifecycle: 7 years → Glacier]
    REPORTS_S3[Report Files\nPDF / XLSX / CSV\nLifecycle: 90 days → expire]
    EVIDENCE_S3[Case Evidence Exports\nchain-of-custody SHA-256\nLifecycle: 7 years → Glacier]
  end

  CAP -->|"clock-out payload"| API_IN
  BATCH -->|"nightly batch import"| API_IN
  API_IN --> VISITS
  API_IN --> VERIF
  API_IN --> QUEUES
  QUEUES -->|"fraud worker"| FRAUD_T
  QUEUES -->|"fraud worker"| RISK
  QUEUES -->|"report worker"| REPORTS_S3
  FRAUD_T -->|"evidence attach"| EVIDENCE_S3
  VERIF -->|"probe images"| PROBES
  USERS_T --- CACHE
  RISK --- CACHE

  subgraph Archive["Archive — S3 Glacier Deep Archive"]
    GLACIER[Monthly partition exports\nafter retention window\n7-year regulatory hold]
  end

  VISITS -->|"pg_partman detach + dump"| GLACIER
  AUDIT -->|"pg_partman detach + dump"| GLACIER
```

### Storage Tier Summary

| Tier | Technology | Data | Retention |
|---|---|---|---|
| Hot OLTP | RDS PostgreSQL Multi-AZ | visits, verifications, fraud events, cases, audit logs, users | Active + 24-month hot rolling window |
| Warm Queue/Cache | ElastiCache Redis Cluster | BullMQ jobs, API cache, session blacklist | Job TTL 24 h; cache TTL 60–300 s |
| Evidence Object | S3 SSE-KMS | Biometric probe images, case evidence exports | 7 years (HIPAA), then Glacier |
| Report Object | S3 SSE-KMS | Generated PDF/XLSX/CSV reports | 90 days, presigned download only |
| Cold Archive | S3 Glacier Deep Archive | Detached monthly partition dumps | 7 years minimum |

---

## 6. Multi-Tenancy Model

### 6.1 Tenant Isolation Architecture

```mermaid
flowchart TD
  REQ["Inbound API Request\nAuthorization: Bearer JWT"]
  JWTGuard["JWTAuthGuard\nExtract userId + orgId from JWT claims"]
  RLS_SET["PrismaService middleware:\nSET LOCAL app.current_org = orgId"]
  RLS_ENFORCE["PostgreSQL RLS Policy:\ntenant_isolation\nUSING organization_id = current_setting('app.current_org')::uuid"]
  DATA["Tenant A rows only\n— other tenants invisible"]

  REQ --> JWTGuard --> RLS_SET --> RLS_ENFORCE --> DATA

  style RLS_ENFORCE fill:#d32f2f,color:#fff
  style DATA fill:#388e3c,color:#fff
```

### 6.2 How Tenant Context Flows

1. **JWT Issuance:** On login, the JWT payload includes `{ sub: userId, org: organizationId, roles: [...] }`. Signed with RS256; public key available at `/.well-known/jwks.json`.

2. **Request Middleware:** A NestJS global middleware extracts `org` from the verified JWT claims and stores it on the request context.

3. **Prisma Middleware:** A Prisma client middleware runs `SET LOCAL app.current_org = '<uuid>'` at the start of every transaction/query session. This sets the PostgreSQL session-level GUC that all RLS policies read.

4. **RLS Enforcement:** Every tenant-scoped table has:

   ```sql
   ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
   ALTER TABLE <table> FORCE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON <table>
     USING (organization_id = current_setting('app.current_org', true)::uuid)
     WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);
   ```

   `FORCE ROW LEVEL SECURITY` ensures the policy applies even to the table owner role.

5. **Bypass Role:** A dedicated `rls_bypass` role (BYPASSRLS privilege) is used only by migration jobs and ops tooling. It is never granted to the application service account.

### 6.3 Noisy-Neighbor Controls

| Control | Mechanism |
|---|---|
| API rate limiting | NestJS `ThrottlerModule` per `org_id` + IP, configurable per tenant tier |
| Queue job quotas | BullMQ rate limiter per `org_id` key prefix; max concurrency per queue |
| DB connection pooling | PgBouncer / RDS Proxy; per-tenant connection limits via pool configuration |
| Report query timeouts | `statement_timeout` set per read-replica session for reporting queries |
| Storage quotas | S3 lifecycle + bucket policy; per-prefix size alarms via CloudWatch |

### 6.4 Tenant Configuration

Each `organizations` row carries a `settings JSONB` column holding per-tenant feature flags, risk thresholds, notification preferences, and branding:

```jsonc
{
  "fraudScoreThreshold": 61,       // minimum score to auto-create case
  "gpsRadiusOverrideMeters": null, // null = use service_authorizations.radius_meters
  "mfaRequired": true,
  "notifyOnRiskLevel": "HIGH",
  "reportRetentionDays": 90,
  "featureFlags": {
    "hardwareIntegration": false,
    "aiRiskScoring": true
  }
}
```

---

## 7. Integration Architecture

### 7.1 Inbound Integration Patterns

```mermaid
flowchart LR
  subgraph StateMMIS["State MMIS / EVV System"]
    SFTP[SFTP Batch File\nCSV / EDI 834 / 837]
    WEBHOOK_IN[Webhook Push\napplication/json]
  end

  subgraph MCO["Managed Care Organization"]
    MCOAPI[MCO REST API\npull authorizations]
  end

  subgraph RayVerify["RayVerify™ Integration Layer"]
    IMPORT[BatchImportService\nIdempotent upsert\nvia authorization_id natural key]
    WHIN[WebhookIngressController\nHMAC-SHA256 signature verification]
    POLL[ScheduledPollService\n@Cron every 15 min]
  end

  SFTP -->|"nightly transfer"| IMPORT
  WEBHOOK_IN -->|"real-time push"| WHIN
  MCOAPI -->|"GET authorizations"| POLL

  IMPORT --> DB[(PostgreSQL\nservice_authorizations\nvisits)]
  WHIN --> DB
  POLL --> DB
```

**Idempotency for batch imports:** Each `ServiceAuthorization` upsert uses `ON CONFLICT (organization_id, patient_id, service_code, start_date) DO UPDATE` semantics. Visit imports key on the upstream EVV system's visit ID stored in an `external_id` field. Duplicate imports are safe.

### 7.2 Outbound Integration: Webhooks & State Exports

```mermaid
flowchart LR
  subgraph Events["Domain Events (internal)"]
    EV1[visit.verified]
    EV2[fraud.case.opened]
    EV3[fraud.case.escalated]
    EV4[provider.risk.changed]
  end

  WH[WebhookDispatchService]
  Q2[Redis: notifications queue]
  DB2[(webhook_subscriptions\nin org settings JSONB)]

  EV1 & EV2 & EV3 & EV4 --> WH
  WH --> DB2
  WH --> Q2
  Q2 -->|"worker: HTTP POST\nHMAC-SHA256 signed\nexponential retry"| EXT[External Endpoint\ne.g. State fraud system\nMCO portal]

  EXPORT[Scheduled Export Job\n@Cron monthly / weekly]
  EXPORT -->|"Query visit / fraud data\nRender CSV/JSON"| S3EXP[(S3: state-compliance-exports/)]
  S3EXP -->|"Presigned URL or\nSFTP push"| STATE[State Agency Portal]
```

### 7.3 API Versioning Strategy

All API routes are prefixed `/v1/`. When a breaking change is required:

1. A new `/v2/` route group is added. The v1 routes are deprecated with a `Sunset` response header (90-day notice).
2. Versioning is path-based (not header-based) for transparency with government integration teams.
3. The OpenAPI 3.1 specification at `api/openapi.yaml` is the contract; any v1 → v2 migration path is documented in the spec's `x-deprecation-notice` extension.

---

## 8. Scalability, Resilience & Failure Modes

### 8.1 Horizontal Scaling Topology

```mermaid
flowchart TD
  ALB[Application Load Balancer\nsticky sessions OFF\nhealth checks /v1/health]

  subgraph ECS_API["ECS Service: api (target: 3–20 tasks)"]
    API1[NestJS Task 1]
    API2[NestJS Task 2]
    APIN[NestJS Task N]
  end

  subgraph ECS_FRAUD["ECS Service: fraud-worker (target: 2–10 tasks)"]
    FW1[Fraud Worker 1]
    FW2[Fraud Worker 2]
  end

  subgraph ECS_REPORT["ECS Service: report-worker (target: 1–5 tasks)"]
    RW1[Report Worker 1]
  end

  ALB --> API1 & API2 & APIN
  API1 & API2 & APIN --> REDIS[(Redis Cluster)]
  FW1 & FW2 --> REDIS
  RW1 --> REDIS

  subgraph RDS["RDS (Multi-AZ)"]
    PRIMARY[(Primary\nwrites)]
    REPLICA[(Read Replica\nreports / dashboards)]
  end

  API1 & API2 & APIN --> PRIMARY
  FW1 & FW2 --> PRIMARY
  RW1 --> REPLICA
```

### 8.2 Resilience & Failure Modes

| Failure Mode | Detection | Recovery |
|---|---|---|
| API task crash | ALB health check fails → ECS replaces task in < 30 s | Stateless tasks; no in-memory state loss |
| RDS primary failure | RDS Multi-AZ automatic failover | < 60 s failover; Prisma connection retry with exponential backoff |
| Redis node failure | ElastiCache cluster mode; automatic slot rebalancing | BullMQ jobs re-queued from persistence log; idempotent job IDs |
| Biometric vendor timeout | 5 s HTTP timeout → circuit breaker (consecutive failures) | Identity step result = REVIEW (not FAIL); human review queue |
| S3 PUT failure (probe image) | SDK retry (3x exponential backoff) | If exhausted: identity step REVIEW; probe key logged as null |
| Fraud detector exception | Try/catch per detector; non-fatal | Failing detector skipped; other detectors run; job completes with partial score |
| Report worker crash mid-render | BullMQ job retried (max 3 attempts) | `reports.status` remains GENERATING until worker re-picks; idempotent report ID |
| Partition missing for future date | `visits_default` catch-all partition | Inserts succeed; pg_partman cron creates named partition and reattaches rows |

### 8.3 Idempotency

- **Visit clock events:** `POST /v1/visits/{id}/clock-out` is idempotent via `visit_verifications.visit_id UNIQUE` constraint. A second request for the same `visitId` will receive the existing `visit_verifications` row.
- **Fraud detection jobs:** BullMQ job IDs are `fraud:${visitId}`. A second enqueue for the same `visitId` deduplicates at the queue level.
- **Batch imports:** `ON CONFLICT ... DO UPDATE` semantics on natural keys.
- **Report generation:** `reports.id` is the idempotency key; re-enqueuing a `QUEUED` report checks `status` before rendering.

### 8.4 Eventual Consistency for Risk Scores

`visits.risk_score` and `visits.risk_level` are updated asynchronously by the fraud worker. The clock-out API response returns the **preliminary** score (computed synchronously from verification chain inputs only). The **final** fraud-enriched score is written within seconds and readable via `GET /v1/visits/{id}`. The `visit_verifications.chain` JSONB field tracks both `preliminary` and `final` score states for audit clarity.

`provider_risk_profiles.current_score` is similarly updated after every fraud detection job and is the denormalized hot read for the provider risk dashboard. Historical point-in-time scores are in `fraud_scores` (time series).

---

*Document version: 1.0 | Platform: RayVerify™ | Classification: Investor/Government Distribution*
