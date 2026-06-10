# RayVerify™ — Developer Handoff

**To:** Sishir Phuyal
**From:** Durga Ghimeray (RayHealthEVV™)
**Date:** 2026-06-10
**Branch:** `Durgas-Mac-mini`

---

## 1. What you're taking over

RayVerify™ is a **government-grade fraud detection & identity verification platform** for Medicaid, HCBS, and personal-care programs — *not* another EVV vendor. Legacy EVV verifies time + location; RayVerify verifies **identity, presence, location, device authenticity, patient confirmation, and billing legitimacy**, and surfaces fraud intelligence to state investigators **before payments are made**.

This repo is the **foundation drop**: the complete data model, production SQL schema, a working NestJS backend with the verification + fraud engines, a Next.js investigator dashboard, the OpenAPI contract, Terraform IaC, CI/CD, and a 12-document architecture/compliance set. Everything compiles, lints, tests, and builds (verified — see §7).

**Read in this order:** this file → `docs/00-overview.md` → `docs/01-product-requirements.md` → `docs/02-system-architecture.md` → skim the rest as needed (index in §10).

---

## 2. Getting the code

```bash
git clone https://github.com/durga710/RayVerify.git
cd RayVerify
git checkout Durgas-Mac-mini
```

The `Durgas-Mac-mini` branch carries the complete foundation with full history; a PR merges it into `main`. CI (`.github/workflows/ci.yml`) runs automatically on the PR.

---

## 3. Quickstart (local dev)

Prereqs: **Node ≥ 20**, **npm ≥ 10**, **Docker**.

```bash
npm ci                                   # install all workspaces (lockfile committed)
npm run dev:infra                        # Postgres 16 + Redis 7 + LocalStack (S3)
cp packages/backend/.env.example packages/backend/.env

# Database: Prisma migrations do NOT exist yet (see §8). For now:
cd packages/backend
npx prisma db push                       # create tables from schema.prisma   …or generate the first migration:
# npx prisma migrate dev --name init
node scripts/apply-sql.js                # physical layer: partitions, RLS, triggers, hash chain
npx prisma db seed                       # demo tenant + visits (one clean, one anomalous)
cd ../..

npm run dev                              # backend :4000, frontend :3000
```

- API + Swagger UI: `http://localhost:4000/api/docs`
- Dashboard: `http://localhost:3000`
- Demo logins (org slug **`state-pi`**):
  - `admin@state-pi.gov` / `ChangeMe!Admin123` (all permissions)
  - `investigator@state-pi.gov` / `ChangeMe!Invest123` (investigation subset)

**Try the engines end-to-end** (Swagger or curl): login → `POST /fraud/visits/{anomalyVisitId}/score` (the seed prints both visit IDs) → see fraud events with explanations → `POST /visits/{id}/verify` for the full chain rollup → `GET /providers/risk-ranking` after `POST /providers/{id}/risk-profile/recompute`.

> ⚠️ **Local RLS caveat:** docker-compose connects as the `rayverify` **superuser**, and superusers bypass row-level security entirely (even `FORCE RLS`). Multi-tenant isolation is therefore *not actually enforced* in this local setup. Before relying on RLS behavior, create a non-superuser app role and point `DATABASE_URL` at it. This is called out again in §8.

---

## 4. Repo map

```
RayVerify/
├── HANDOFF.md                  ← you are here
├── README.md                   ← product overview + quickstart
├── package.json                ← npm workspaces root (scripts: dev/build/lint/test/typecheck)
├── docker-compose.yml          ← Postgres + Redis + LocalStack
├── db/schema.sql               ← PHYSICAL source of truth: enums, partitioning, RLS,
│                                  immutability triggers, audit hash chain (apply AFTER Prisma)
├── api/openapi.yaml            ← OpenAPI 3.1 contract (live spec served by backend at /api/docs)
├── docs/                       ← 12 architecture/compliance docs (index in §10)
├── packages/
│   ├── shared/                 ← enums/types shared FE↔BE (string unions, no Prisma import)
│   ├── backend/                ← NestJS + Prisma (the platform)
│   │   ├── prisma/schema.prisma   ← canonical logical model (22 tables)
│   │   ├── prisma/seed.ts         ← demo tenant (RLS-aware seeding pattern)
│   │   ├── scripts/apply-sql.js   ← applies db/schema.sql physical layer
│   │   └── src/
│   │       ├── main.ts            ← bootstrap: helmet, CORS, versioning, Swagger
│   │       ├── app.module.ts      ← module wiring + global guards
│   │       ├── config/            ← typed env config (thresholds live here)
│   │       ├── common/            ← TenantContext (ALS), PrismaService (RLS),
│   │       │                        guards (JWT, permissions), interceptors, filters,
│   │       │                        geo/risk utils, pagination
│   │       └── modules/
│   │           ├── auth/          ← login/refresh/logout/me, Argon2id, MFA, sessions
│   │           ├── identity/      ← Module 1: selfie+liveness, pluggable IdentityProvider
│   │           ├── visits/        ← Module 2: clock-in/out, geofence, verification chain
│   │           ├── fraud/         ← Module 3: detectors + noisy-OR score fusion
│   │           ├── cases/         ← Module 4: case mgmt (notes, evidence, assign, status)
│   │           ├── providers/     ← Module 5: provider risk profiles + ranking
│   │           ├── audit/         ← Module 6: immutable trail + chain verification
│   │           ├── reports/       ← Module 7: report queue (renderer worker TBD)
│   │           ├── notifications/ ← in-app notifications
│   │           ├── hardware/      ← Module 8: SDK interfaces (NFC/fingerprint/face/SE/GPS/LTE)
│   │           └── health/
│   └── frontend/               ← Next.js 15 dashboard (11 routes, renders from lib/mock.ts)
├── infra/terraform/            ← AWS IaC: 7 modules (networking/security/data/compute/
│                                  edge/storage/observability) + env tfvars examples
└── .github/workflows/          ← ci.yml, codeql.yml, security-scan.yml, deploy.yml
```

---

## 5. Architecture crash course (the load-bearing conventions)

| Convention | Detail |
|---|---|
| **Multi-tenancy** | Every business table carries `organizationId`. Hard isolation via Postgres **row-level security**: policies check `current_setting('app.current_org')`. The app binds the tenant per request in `TenantContext` (AsyncLocalStorage, set by `ContextInterceptor` from the JWT) and `PrismaService.forRequest()` wraps every query in a **batch transaction** `[set_config('app.current_org', …, true), query]` — Prisma's documented RLS pattern. Use `prisma.forRequest()` in services, never raw `prisma`, unless intentionally pre-tenant (login, health). |
| **Verification chain** | A visit's package = identity → GPS → device → patient → fraud score → approval. Each step writes an **append-only** evidence row (`identity_verifications`, `gps_verifications`, `device_verifications`); the rollup lands in `visit_verifications` with a SHA-256 `evidenceHash`. Results are `PASS / REVIEW / FAIL`; any FAIL or fraud >80 ⇒ FAIL; any REVIEW or fraud >60 ⇒ REVIEW. Missing evidence ⇒ REVIEW, never silent PASS. |
| **Risk bands** | 0–30 LOW · 31–60 MODERATE · 61–80 HIGH · 81–100 CRITICAL. One implementation in `common/util/risk.ts`, mirrored in `@rayverify/shared` and the frontend. Change in lockstep or don't change. |
| **Fraud engine** | Pure, unit-testable detectors (`fraud/detectors/*`) consume a pre-assembled `VisitFeatureContext` (no DB inside detectors). `FraudScoringService.fuse()` combines severities via weighted **noisy-OR** → composite 0–100 + per-factor contributions (**explainability is a hard product requirement** — every score must show *why*). Detector `version` fields are persisted for reproducibility. |
| **Immutability** | `audit_logs`, the three verification tables, and `fraud_events` are append-only, enforced by DB triggers (`rv_forbid_mutation`). `audit_logs` carries a per-tenant SHA-256 **hash chain** computed by a DB trigger (can't be forged from app code); `GET /audit/verify-chain` checks linkage. |
| **Data types** | UUID v4 PKs · money in integer **cents** · geo as `Decimal(9,6)` · timestamps UTC. GPS rule: inside authorized radius = PASS, outside = FLAG/REVIEW, >5× radius = FAIL. |
| **AuthZ** | RBAC. Permission keys are `resource:action` (`fraud_case:assign`). Routes declare `@RequirePermissions(...)`; JWT carries the resolved permission set; `PermissionsGuard` enforces. Global guards: Throttler → JWT (`@Public()` opts out) → Permissions. |
| **Partitioning** | `visits` (by `scheduled_start`) and `audit_logs` (by `created_at`) are monthly range-partitioned in `db/schema.sql`. Prisma doesn't know about partitions — physical DDL lives in SQL only. Rolling partition creation is an ops job (pg_partman/cron; see docs/03 + docs/11). |

Stack: **Next.js 15 / TS / Tailwind / shadcn** · **NestJS / Prisma / PostgreSQL 16 / Redis** · **AWS: ECS Fargate, RDS Multi-AZ, S3 (+ Object Lock WORM), CloudFront, KMS** · JWT + refresh rotation, Argon2id, MFA (otplib), helmet, throttling.

---

## 6. Key entry points (start reading here)

| What | File |
|---|---|
| RLS/tenancy core | `packages/backend/src/common/prisma/prisma.service.ts`, `common/context/tenant-context.ts` |
| Verification chain | `packages/backend/src/modules/visits/visits.service.ts` (`runVerificationChain`, `evaluateGeofence`) |
| Fraud orchestration | `packages/backend/src/modules/fraud/fraud.service.ts` (`scoreVisit`, `buildContext`) |
| Score fusion math | `packages/backend/src/modules/fraud/fraud-scoring.service.ts` |
| Detector contract | `packages/backend/src/modules/fraud/detectors/types.ts` |
| Identity vendor seam | `packages/backend/src/modules/identity/providers/identity-provider.interface.ts` |
| Hardware SDK seam | `packages/backend/src/modules/hardware/sdk/*` |
| Audit hash chain (DB) | `db/schema.sql` §9 (`rv_audit_hash_chain`, `rv_forbid_mutation`) |
| Frontend types/mocks | `packages/frontend/lib/types.ts`, `lib/mock.ts`, `lib/api.ts` |
| Engine tests | `packages/backend/test/fraud-engine.spec.ts` |

---

## 7. Verified state (re-run these)

All of the following were run and pass in this workspace:

```bash
npm run typecheck --workspace @rayverify/shared     # ✅
npm run typecheck --workspace @rayverify/backend    # ✅
npm run lint      --workspace @rayverify/backend    # ✅ (--max-warnings 0)
npm run test      --workspace @rayverify/backend    # ✅ 9/9 (fraud engine + geo + fusion)
npm run build     --workspace @rayverify/backend    # ✅ nest build
npm run typecheck --workspace @rayverify/frontend   # ✅
npm run build     --workspace @rayverify/frontend   # ✅ next build, 11 routes
```

CI (`.github/workflows/ci.yml`) runs the same plus an ephemeral Postgres/Redis, CodeQL, gitleaks, and Trivy. Both jobs are blocking.

---

## 8. Known gaps & honest notes (read before estimating anything)

**Stubs / not yet implemented**
1. **Identity matching is a stub.** `StubIdentityProvider` returns 0.96/0.98 (override with `simulate{confidence,liveness}` in `POST /identity/verify` to exercise REVIEW/FAIL). Real vendor (AWS Rekognition or a NIST-tested SDK) plugs in behind `IdentityProvider` — swap the binding in `identity.module.ts`.
2. **Patient confirmation step is hardcoded `PASS`** in `visits.service.ts` (`runVerificationChain`). The schema/docs define it; the capture mechanism (patient attestation) is unbuilt.
3. **6 of 13 detectors implemented:** impossible-travel, GPS/geofence, duplicate-visit, shared-device(+tampering), abnormal-duration, identity-mismatch(+liveness). **Missing:** `UNUSUAL_BILLING`, `EXCESSIVE_OVERTIME`, `SERVICE_OVERLAP`, `CROSS_PROVIDER_RISK` — full specs with formulas are in `docs/05-fraud-detection-engine.md`; follow the existing detector pattern (pure class + context fields + unit tests).
4. **No async workers yet.** `bullmq`/`ioredis` are dependencies, the docs describe the Redis pipeline, but scoring currently runs synchronously inside the request (`POST /fraud/visits/:id/score`, `/visits/:id/verify`). Report generation: requests persist as `QUEUED`, **no renderer** (PDF/XLSX) exists. Build: queue producer in FraudService/ReportsService + a worker process (separate Nest app or `@nestjs/bullmq`).
5. **No S3 integration code.** Evidence keys (`probeS3Key`, `referenceS3Key`, report `s3Key`) are stored as strings; upload/presign endpoints are unbuilt (LocalStack is ready in compose; bucket names in `.env.example`).
6. **Audit recording is not automatic.** The DB hash chain + `AuditService.record()` + search/verify endpoints work, but services don't call `record()` yet and there's no global audit interceptor. Decide: explicit calls at sensitive points (recommended: verify/score/case actions/exports) vs. a blanket interceptor.
7. **Notifications** persist in-app rows only; email/SMS/webhook senders are unbuilt. **MFA** verification path exists at login, but enrollment endpoints (secret provisioning, QR) are unbuilt, and `mfaSecret` must be KMS-encrypted before production.
8. **Frontend renders mock data** (`lib/mock.ts`). The typed client (`lib/api.ts`) exists but pages aren't wired to it; no auth flow on the FE. Wiring TanStack Query → API is mostly mechanical since the types mirror the backend.

**Sharp edges / risks**
9. **No Prisma migrations are committed.** `schema.prisma` + `db/schema.sql` exist, but `prisma/migrations/` doesn't. First DB task: `prisma migrate dev --name init`, then reconcile with `apply-sql.js` (partitioned tables: Prisma will create plain `visits`/`audit_logs`; the SQL file creates partitioned versions — **decide the order**: cleanest is to let the init migration create everything *except* the partitioned tables and move those + RLS + triggers into a follow-up SQL migration, as described in `docs/03-database-design.md` §8). CI's migrate step is currently tolerant (`|| true`) for this reason — tighten it once migrations exist.
10. **RLS is bypassed locally** (superuser — see §3 note). Also the **runtime AWS role must NOT have `BYPASSRLS`**; only the migration/ops role should.
11. **AsyncLocalStorage propagation:** the tenant context is entered in an interceptor around an RxJS stream. The auth-service paths await inside `run()` scopes (safe), but **any new code that creates a lazy Prisma promise inside `run()` and awaits it outside can silently lose the tenant** (→ zero rows under real RLS). Standing rule: `await` Prisma calls inside the same async scope. A middleware-based context (wrapping the whole request) is a sturdier long-term home — worth doing alongside the first integration tests with a non-superuser role.
12. **Org slug is user-supplied at login.** Login resolves tenant by `organizationSlug` then checks credentials inside that scope — fine, but rate-limit and keep failures uniform (already uniform 401s; throttler is global).
13. **`deploy.yml` is a skeleton** (echo placeholders for migration task + smoke test; needs `AWS_DEPLOY_ROLE_ARN`, ECR/ECS vars, protected environments). **Terraform has never been `plan`ned against a real account** — treat as strong scaffolding, expect drift fixes (backend config, ACM/Route53 inputs).
14. **Compliance posture:** the controls are designed-in (docs/07), but this is **not** an ATO'd system. No pen test, no BAA chain, no real PHI until Phase 5 of the roadmap (docs/10).

---

## 9. Suggested first two weeks

1. **Day 1:** Clone the repo, get CI green, run the quickstart; exercise the seeded anomaly visit end-to-end.
2. Generate the **init Prisma migration** + ordered SQL migrations for partitions/RLS/triggers (gap #9). Tighten the CI migrate step.
3. Create a **non-superuser DB role** locally; add integration tests proving cross-tenant isolation (two orgs, assert zero leakage) and the ALS rule (#11).
4. Wire **frontend → API** for one vertical slice (login → visits list → visit detail with real verification chain), keeping mocks elsewhere.
5. Implement the **4 missing detectors** from docs/05 with unit tests (pattern: `test/fraud-engine.spec.ts`).
6. Stand up **BullMQ worker** for fraud scoring fan-out + the report renderer (even CSV-only first).
7. Add **audit `record()` calls** at: verify, score, case actions, report export, login/logout.
8. Spike one **real identity vendor** behind `IdentityProvider` (Rekognition `CompareFaces` + a liveness option) in a branch.

Longer arc: `docs/10-development-roadmap.md` (phases, exit criteria, KPIs).

---

## 10. Documentation index

| Doc | Contents |
|---|---|
| `docs/00-overview.md` | Mission, problem, value prop vs legacy EVV, 8 modules, glossary |
| `docs/01-product-requirements.md` | Full PRD: personas, FRs/ACs per module, NFRs, reporting |
| `docs/02-system-architecture.md` | C4 diagrams, module map, runtime sequences, tenancy, integrations |
| `docs/03-database-design.md` | ERD, table reference, indexes, partitioning, RLS, PHI handling, migrations |
| `docs/04-api-design.md` | Conventions, versioning, errors, endpoint catalog (+ `api/openapi.yaml`) |
| `docs/05-fraud-detection-engine.md` | All 13 detectors with formulas/thresholds/evidence JSON, fusion, tuning |
| `docs/06-ai-risk-scoring.md` | Feature store, models (IsolationForest→LightGBM→graph), SHAP, MLOps |
| `docs/07-security-architecture.md` | STRIDE, IAM/RBAC, encryption/KMS, RLS deep-dive, HIPAA/NIST/SOC2/CMS maps |
| `docs/08-aws-deployment.md` | VPC topology, ECS, RDS, S3 WORM, KMS, GovCloud path, cost table |
| `docs/09-cicd-pipeline.md` | CI stages, CD with approvals, OIDC, quality gates |
| `docs/10-development-roadmap.md` | Phases 0–7, gantt, milestones, risks, KPIs |
| `docs/11-production-deployment.md` | Envs, blue/green, observability/SLOs, DR, breach playbook, go-live runbook |

---

## 11. Working agreements

- **Quality gates:** `lint --max-warnings 0`, `tsc --noEmit`, tests, and both builds must stay green — CI blocks on all of them.
- **Never** weaken the append-only triggers, the hash chain, or RLS to "make something work" — fix the access pattern instead.
- New detectors/scorers must persist `detector` + `detectorVersion` and a human-readable `explanation` (explainability is contractual, not cosmetic).
- Secrets: only `.env` (gitignored); `.env.example` documents every knob. Demo passwords are placeholders — rotate anything real.
- Keep `@rayverify/shared`, `common/util/risk.ts`, and the frontend risk helpers in lockstep.

Questions → Durga (reyghim1093@gmail.com). Good luck — the fun parts (the four billing detectors and the ML scorer) are well-specified and waiting.
