# AGENTS.md - RayVerify instructions for AI coding agents

Read this fully before changing anything. Human onboarding doc: `HANDOFF.md`.
Deep specs: `docs/00`-`docs/11`. Working branch: `Durgas-Mac-mini` (PR #1 to `main`).

## What this project is

RayVerify is a government-grade fraud detection and identity verification platform for
Medicaid, HCBS, and personal-care programs (parent: RayHealthEVV). It verifies caregiver
identity, presence, location, device authenticity, patient confirmation, and billing
legitimacy, then surfaces explainable fraud intelligence to state investigators before
payments are made. It is not an EVV time-tracking product.

Monorepo: npm workspaces.

- `packages/backend`: NestJS, Prisma, PostgreSQL, Redis
- `packages/frontend`: Next.js 15, Tailwind, shadcn-style UI
- `packages/shared`: TypeScript types
- `db/schema.sql`: physical PostgreSQL DDL
- `api/openapi.yaml`: OpenAPI 3.1 contract
- `infra/terraform`: AWS infrastructure
- `.github/workflows`: CI/CD and security scanning

## Commands

Run from the repo root:

```bash
npm ci
npm run dev:infra
cp packages/backend/.env.example packages/backend/.env

cd packages/backend
npx prisma db push
node scripts/apply-sql.js
npx prisma db seed
cd ../..

npm run dev
```

Local services:

- Backend: `http://localhost:4000`
- Swagger UI: `http://localhost:4000/api/docs`
- Frontend: `http://localhost:3000`

Demo logins, org slug `state-pi`:

- `admin@state-pi.gov` / `ChangeMe!Admin123`
- `investigator@state-pi.gov` / `ChangeMe!Invest123`

## Quality Gates

All must pass before considering a task done:

```bash
npm run typecheck --workspace @rayverify/backend
npm run lint --workspace @rayverify/backend
npm run test --workspace @rayverify/backend
npm run build --workspace @rayverify/backend
npm run typecheck --workspace @rayverify/frontend
npm run build --workspace @rayverify/frontend
```

CI blocks on lint, typecheck, tests, builds, CodeQL, gitleaks, and Trivy.

## Hard Rules

1. Never weaken security primitives to make code work: row-level security, append-only
   triggers, audit hash chain, guards, throttling, and tenant isolation must stay intact.
   Fix the access pattern instead.
2. Tenant-scoped database access goes through `this.prisma.forRequest()`, implemented in
   `src/common/prisma/prisma.service.ts`. It binds `app.current_org` for PostgreSQL RLS
   from `TenantContext` using AsyncLocalStorage. Raw `this.prisma` is allowed only for
   intentionally pre-tenant paths such as login bootstrap and health checks.
3. Await Prisma calls inside the same `TenantContext.run` scope that created them. Lazy
   promises awaited outside the scope can silently lose the tenant.
4. Evidence tables are append-only. Never update or delete rows in
   `identity_verifications`, `gps_verifications`, `device_verifications`, `fraud_events`,
   or `audit_logs`. The database rejects mutations; do not remove those triggers.
5. Explainability is contractual. Every fraud score or event must persist a human-readable
   `explanation`, structured `evidence` or `factors`, and `detector` plus
   `detectorVersion`.
6. Canonical risk bands are 0-30 LOW, 31-60 MODERATE, 61-80 HIGH, and 81-100 CRITICAL.
   Keep `src/common/util/risk.ts`, `@rayverify/shared`, and
   `packages/frontend/lib/risk.ts` in sync.
7. Verification results are `PASS`, `REVIEW`, or `FAIL`. Missing evidence is `REVIEW`,
   never silent `PASS`.
8. Money is integer cents. IDs are UUIDs. Geo coordinates use `Decimal(9,6)`. Timestamps
   are UTC.
9. Schema changes go to both `packages/backend/prisma/schema.prisma` and `db/schema.sql`.
   Keep logical Prisma schema and physical PostgreSQL DDL in sync, including enums,
   partitions, RLS policies, and triggers.
10. New endpoints must declare `@RequirePermissions('resource:action')`. Add new
    permission keys to `prisma/seed.ts` and grant them to the right seeded roles.
11. No secrets in code or commits. Configuration belongs in env vars documented in
    `.env.example`. Do not log PHI.
12. Detector thresholds belong in `src/config/configuration.ts` until tenant overrides
    are implemented through `organizations.settings`.
13. Fraud detectors are pure. Classes in `src/modules/fraud/detectors/` consume a
    pre-assembled `VisitFeatureContext`, perform no database access, and return severity
    0-100 plus evidence. Register new detectors in `FraudService.detectors`, weight them
    in `FraudScoringService`, and unit-test them following `test/fraud-engine.spec.ts`.

## Current State

The foundation release is verified green:

- Backend and frontend compile, lint, and build
- Backend tests pass, 9/9
- CI passed for lint, typecheck, tests, and builds
- CodeQL, gitleaks, and Trivy are configured for PR security scanning
- Seed data includes demo tenant `state-pi`
- The seeded anomalous visit exercises:
  `POST /api/v1/fraud/visits/{id}/score` to fraud events with explanations to composite
  score

Known stubs and gaps, with full detail in `HANDOFF.md` section 8:

- Identity matcher is `StubIdentityProvider`, supporting `simulateConfidence` and
  `simulateLiveness`
- Patient confirmation step is hardcoded `PASS` in `visits.service.ts`
- 6 of 13 planned detectors are implemented
- BullMQ workers are not implemented; scoring runs synchronously
- Report renderer is absent; report rows stay `QUEUED`
- S3 upload code is not implemented
- `AuditService.record()` is not called automatically across workflows
- Frontend renders `packages/frontend/lib/mock.ts`, not the real API
- Prisma migrations are not committed yet
- Local Docker user is a PostgreSQL superuser, so RLS is not actually enforced locally;
  integration tests need a non-superuser role

## Prioritized Backlog

Work top-down unless the user says otherwise.

1. Frontend/API wiring: replace `packages/frontend/lib/mock.ts` usage with real API calls
   through `packages/frontend/lib/api.ts` and TanStack Query. Start with login, visits
   list, visit detail, and verification chain. Keep `packages/frontend/lib/types.ts`
   aligned with backend DTOs.
2. Initial Prisma migration: generate `prisma/migrations` and ordered SQL migrations for
   partitioned `visits` and `audit_logs`, RLS, and triggers per
   `docs/03-database-design.md` section 8. Remove the softened CI migrate step once real
   migrations exist.
3. Remaining detectors: implement `UNUSUAL_BILLING`, `EXCESSIVE_OVERTIME`,
   `SERVICE_OVERLAP`, and `CROSS_PROVIDER_RISK` from
   `docs/05-fraud-detection-engine.md`. Keep them pure, add unit tests, and tune fusion
   weights.
4. Async pipeline: add BullMQ producer paths in `FraudService` and `ReportsService`, a
   worker process, async scoring fan-out, CSV/XLSX report rendering, S3 or LocalStack
   storage, and `reports.status = READY`.
5. RLS integration tests: add a non-superuser DB role, two seeded organizations, and
   assertions that endpoints cannot leak cross-tenant data. Include coverage for the
   AsyncLocalStorage tenant-scope rule.
6. Audit coverage: call `AuditService.record()` at verify, score, case actions, report
   export, login, and logout. Add `GET /audit/verify-chain` to a CI smoke path.
7. Identity vendor adapter: implement a real `IdentityProvider`, such as AWS Rekognition
   CompareFaces plus liveness, behind `identity-provider.interface.ts`. Keep the stub for
   tests.
8. MFA enrollment: add TOTP provisioning and QR endpoints, plus KMS encryption for
   `mfaSecret`.

Roadmap beyond this is in `docs/10-development-roadmap.md`.

## Conventions

- TypeScript strict mode
- NestJS module layout: controller, service, DTO, module per feature
- DTO validation with `class-validator`
- Swagger decorators on all endpoints
- Conventional commit messages: `feat:`, `fix:`, `docs:`, `chore:`, `ci:`
- Match surrounding code style
- Do not add license headers
- Add comments only where the code cannot say the thing clearly itself
- Branch from `Durgas-Mac-mini`, or from `main` after PR #1 merges
- Open PRs with quality gates green
- Never force-push shared branches
