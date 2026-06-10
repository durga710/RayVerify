# CLAUDE.md - RayVerify instructions for Claude Code

Claude Code should read this file before changing anything in this repository.
Human onboarding lives in `HANDOFF.md`. General AI-agent instructions live in
`AGENTS.md`. Deep specs are in `docs/00` through `docs/11`.

Current working branch: `Durgas-Mac-mini`.
Open PR: `https://github.com/durga710/RayVerify/pull/1`.

## Project Summary

RayVerify is a government-grade fraud detection and identity verification platform for
Medicaid, HCBS, and personal-care programs. It belongs under the RayHealthEVV parent
brand, but it is not an EVV time-tracking product.

RayVerify verifies caregiver identity, presence, location, device authenticity, patient
confirmation, and billing legitimacy. It then gives state investigators explainable fraud
intelligence before payments are made.

Monorepo layout:

- `packages/backend`: NestJS, Prisma, PostgreSQL, Redis
- `packages/frontend`: Next.js 15, Tailwind, shadcn-style UI
- `packages/shared`: shared TypeScript types
- `db/schema.sql`: physical PostgreSQL DDL, partitions, RLS, triggers, audit hash chain
- `api/openapi.yaml`: OpenAPI 3.1 contract
- `infra/terraform`: AWS infrastructure
- `.github/workflows`: CI, CodeQL, gitleaks, Trivy, deploy skeleton

## First Thing To Do In Any Claude Session

Run these before making assumptions:

```bash
git status --short --branch
git log --oneline --decorate -5
sed -n '1,220p' HANDOFF.md
sed -n '1,220p' AGENTS.md
```

If the task is code work, inspect the relevant files before editing. If the task touches
security, tenancy, audit, identity, fraud scoring, or schema, also read the matching doc
under `docs/`.

## Local Setup

Run from repo root:

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

## Required Quality Gates

Run the relevant subset while iterating, and all of these before claiming code work is done:

```bash
npm run typecheck --workspace @rayverify/backend
npm run lint --workspace @rayverify/backend
npm run test --workspace @rayverify/backend
npm run build --workspace @rayverify/backend
npm run typecheck --workspace @rayverify/frontend
npm run build --workspace @rayverify/frontend
```

Security checks used by CI:

```bash
npm audit --audit-level=high
gitleaks dir . --redact --verbose --exit-code 1
trivy fs --severity HIGH,CRITICAL --ignore-unfixed .
```

CI currently runs backend/frontend gates, CodeQL, gitleaks, dependency audit, and Trivy.

## Hard Rules

1. Never weaken row-level security, append-only evidence triggers, audit hash chain,
   auth guards, throttling, tenant scoping, or security scanning to make code pass.
   Fix the implementation instead.
2. Tenant-scoped database access goes through `this.prisma.forRequest()`. Raw
   `this.prisma` is allowed only for intentionally pre-tenant paths such as login
   bootstrap and health checks.
3. Await Prisma work inside the same `TenantContext.run` scope that created it. Lazy
   promises awaited outside the scope can lose tenant context.
4. Evidence tables are append-only. Never update or delete rows in
   `identity_verifications`, `gps_verifications`, `device_verifications`, `fraud_events`,
   or `audit_logs`.
5. Every fraud score or fraud event must persist human-readable `explanation`,
   structured `evidence` or `factors`, and `detector` plus `detectorVersion`.
6. Keep canonical risk bands in sync everywhere: 0-30 LOW, 31-60 MODERATE,
   61-80 HIGH, 81-100 CRITICAL.
7. Verification results are `PASS`, `REVIEW`, or `FAIL`. Missing evidence is `REVIEW`,
   never silent `PASS`.
8. Money is integer cents. IDs are UUIDs. Geo coordinates use `Decimal(9,6)`.
   Timestamps are UTC.
9. Schema changes must update both `packages/backend/prisma/schema.prisma` and
   `db/schema.sql`.
10. New endpoints must declare `@RequirePermissions('resource:action')`; add new
    permission keys to `prisma/seed.ts`.
11. No secrets in code or commits. No PHI in logs.
12. Fraud detectors must stay pure: no database access inside detector classes.

## Current Verified State

The foundation release and PR branch are green:

- Backend typecheck, lint, tests, and build pass
- Frontend typecheck and build pass
- Backend fraud-engine tests pass, 9/9
- CodeQL passes
- Gitleaks passes
- Trivy high/critical scan passes
- Dependency audit high/critical gate passes

Recent dependency/security baseline:

- Nest package family is on 11.x
- Next.js is on 15.5.19
- Security workflow limits Trivy SARIF to HIGH/CRITICAL findings

## Known Gaps

Full detail is in `HANDOFF.md` section 8.

- Identity matcher is still `StubIdentityProvider`
- Patient confirmation is hardcoded `PASS` in `visits.service.ts`
- 6 of 13 planned fraud detectors are implemented
- BullMQ workers are pending; scoring is synchronous
- Report renderer is pending; report rows stay `QUEUED`
- S3 upload/presign code is pending
- `AuditService.record()` is not yet called automatically
- Frontend still uses `packages/frontend/lib/mock.ts`
- Prisma migrations are not generated yet
- Local Docker DB uses a PostgreSQL superuser, so local RLS behavior is not trustworthy

## Prioritized Backlog

Work in this order unless Durga says otherwise:

1. Wire frontend to real API through `packages/frontend/lib/api.ts` and TanStack Query:
   login, visits list, visit detail, verification chain.
2. Generate initial Prisma migrations and ordered SQL migrations for partitions, RLS,
   append-only triggers, and audit hash chain. Tighten the CI migrate step afterward.
3. Implement remaining detectors from `docs/05-fraud-detection-engine.md`:
   `UNUSUAL_BILLING`, `EXCESSIVE_OVERTIME`, `SERVICE_OVERLAP`, `CROSS_PROVIDER_RISK`.
4. Add BullMQ async scoring/report pipeline and report renderer.
5. Add RLS integration tests using a non-superuser DB role and two seeded organizations.
6. Add audit recording at verify, score, case actions, report export, login, and logout.
7. Implement a real identity vendor adapter behind `identity-provider.interface.ts`.
8. Add MFA enrollment endpoints and KMS encryption for `mfaSecret`.

## Claude Code Working Style

- Keep changes scoped to the requested task.
- Do not rewrite unrelated files.
- Check `git status` before staging.
- Stage explicit paths only.
- Use conventional commits.
- Push to `Durgas-Mac-mini` while PR #1 is open.
- Never force-push shared branches.
- If GitHub checks fail, inspect Actions logs with `gh` before guessing.

Useful commands:

```bash
gh pr view 1 --json url,headRefOid,mergeStateStatus,statusCheckRollup
gh pr checks 1 --watch --interval 10
gh run view <run-id> --log-failed
```

## File Map

- Tenancy/RLS core: `packages/backend/src/common/prisma/prisma.service.ts`
- Tenant context: `packages/backend/src/common/context/tenant-context.ts`
- Visit verification chain: `packages/backend/src/modules/visits/visits.service.ts`
- Fraud orchestration: `packages/backend/src/modules/fraud/fraud.service.ts`
- Fraud score fusion: `packages/backend/src/modules/fraud/fraud-scoring.service.ts`
- Detector contract: `packages/backend/src/modules/fraud/detectors/types.ts`
- Identity provider seam: `packages/backend/src/modules/identity/providers/identity-provider.interface.ts`
- Hardware SDK seam: `packages/backend/src/modules/hardware/sdk/`
- Audit DB triggers: `db/schema.sql`
- Frontend API client: `packages/frontend/lib/api.ts`
- Frontend mock data: `packages/frontend/lib/mock.ts`
- Frontend risk mirror: `packages/frontend/lib/risk.ts`
- Backend fraud tests: `packages/backend/test/fraud-engine.spec.ts`
