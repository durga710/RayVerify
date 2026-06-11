-- =============================================================================
-- RayVerify(TM) — Production PostgreSQL Schema
-- Government-grade fraud detection & identity verification (Medicaid / HCBS).
--
-- This is the PHYSICAL source of truth. It complements the Prisma logical model
-- (packages/backend/prisma/schema.prisma) with concerns Prisma cannot express:
--   * Native ENUM types
--   * Declarative range PARTITIONING (visits, audit_logs, verification tables)
--   * ROW-LEVEL SECURITY for hard multi-tenant isolation
--   * Immutability triggers on append-only / evidence tables
--   * Tamper-evident hash chain on audit_logs
--
-- Target: PostgreSQL 15+. Tested against 16.
-- Apply order: extensions -> enums -> tables -> partitions -> rls -> triggers.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email/slug
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy search on names/case numbers
-- Optional (recommended in prod for geofencing): CREATE EXTENSION postgis;

-- -----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -----------------------------------------------------------------------------
CREATE TYPE user_status        AS ENUM ('ACTIVE','INACTIVE','SUSPENDED','LOCKED','PENDING_INVITE');
CREATE TYPE mfa_method         AS ENUM ('NONE','TOTP','SMS','WEBAUTHN');
CREATE TYPE verification_result AS ENUM ('PASS','REVIEW','FAIL');
CREATE TYPE risk_level         AS ENUM ('LOW','MODERATE','HIGH','CRITICAL');
CREATE TYPE visit_status       AS ENUM ('SCHEDULED','IN_PROGRESS','COMPLETED','FLAGGED','REJECTED','APPROVED','CANCELLED');
CREATE TYPE identity_method    AS ENUM ('SELFIE','LIVENESS','DEVICE_TRUST','FINGERPRINT','NFC_CARD','GOV_CREDENTIAL');
CREATE TYPE device_trust_level AS ENUM ('TRUSTED','UNKNOWN','SUSPICIOUS','BLOCKED');
CREATE TYPE device_platform    AS ENUM ('IOS','ANDROID','WEB','HARDWARE_TERMINAL');
CREATE TYPE fraud_event_type   AS ENUM (
  'IMPOSSIBLE_TRAVEL','DUPLICATE_VISIT','SHARED_DEVICE','GPS_ANOMALY','IDENTITY_MISMATCH',
  'UNUSUAL_BILLING','ABNORMAL_DURATION','EXCESSIVE_OVERTIME','SERVICE_OVERLAP',
  'CROSS_PROVIDER_RISK','LIVENESS_FAILURE','DEVICE_TAMPERING','GEOFENCE_BREACH');
CREATE TYPE fraud_event_status AS ENUM ('OPEN','TRIAGED','LINKED_TO_CASE','DISMISSED','CONFIRMED');
CREATE TYPE case_status        AS ENUM ('OPEN','IN_REVIEW','ESCALATED','PENDING_PAYMENT_HOLD','SUBSTANTIATED','UNSUBSTANTIATED','CLOSED');
CREATE TYPE case_priority      AS ENUM ('LOW','MEDIUM','HIGH','URGENT');
CREATE TYPE score_subject_type AS ENUM ('VISIT','PROVIDER','CAREGIVER','PATIENT','CLAIM');
CREATE TYPE report_type        AS ENUM ('FRAUD_SUMMARY','PROVIDER_RISK','VISIT_VERIFICATION','INVESTIGATION','STATE_COMPLIANCE','EXECUTIVE_DASHBOARD');
CREATE TYPE report_format      AS ENUM ('PDF','XLSX','CSV','JSON');
CREATE TYPE report_status      AS ENUM ('QUEUED','GENERATING','READY','FAILED','EXPIRED');
CREATE TYPE notification_channel AS ENUM ('IN_APP','EMAIL','SMS','WEBHOOK');
CREATE TYPE notification_status  AS ENUM ('PENDING','SENT','DELIVERED','READ','FAILED');
CREATE TYPE audit_action       AS ENUM ('CREATE','READ','UPDATE','DELETE','LOGIN','LOGOUT','EXPORT','VERIFY','SCORE','CASE_ACTION','CONFIG_CHANGE');

-- -----------------------------------------------------------------------------
-- 2. TENANCY, IDENTITY & ACCESS CONTROL
-- -----------------------------------------------------------------------------
CREATE TABLE organizations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         CITEXT NOT NULL UNIQUE,
  jurisdiction TEXT,
  settings     JSONB NOT NULL DEFAULT '{}',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           CITEXT NOT NULL,
  password_hash   TEXT,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  phone           TEXT,
  status          user_status NOT NULL DEFAULT 'PENDING_INVITE',
  mfa_method      mfa_method NOT NULL DEFAULT 'NONE',
  mfa_secret      TEXT,
  last_login_at   TIMESTAMPTZ,
  failed_logins   INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);
CREATE INDEX idx_users_org_status ON users (organization_id, status);

CREATE TABLE sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  user_agent         TEXT,
  ip_address         INET,
  expires_at         TIMESTAMPTZ NOT NULL,
  revoked_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user_exp ON sessions (user_id, expires_at);

CREATE TABLE roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,   -- "resource:action"
  description TEXT
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- -----------------------------------------------------------------------------
-- 3. DOMAIN: PROVIDERS, CAREGIVERS, PATIENTS, AUTHORIZATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE providers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  npi             TEXT,
  medicaid_id     TEXT,
  legal_name      TEXT NOT NULL,
  tax_id          TEXT,  -- encrypted at app layer
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, npi),
  CONSTRAINT chk_npi_format CHECK (npi IS NULL OR npi ~ '^[0-9]{10}$')
);
CREATE INDEX idx_providers_org_active ON providers (organization_id, is_active);

CREATE TABLE caregivers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id     UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  external_id     TEXT,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           CITEXT,
  phone           TEXT,
  status          user_status NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_caregivers_org_provider ON caregivers (organization_id, provider_id);

CREATE TABLE biometric_enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id     UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  method           identity_method NOT NULL DEFAULT 'SELFIE',
  reference_s3_key TEXT,
  template_ref     TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  enrolled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  retired_at       TIMESTAMPTZ
);
CREATE INDEX idx_enrollments_caregiver_active ON biometric_enrollments (caregiver_id, is_active);

CREATE TABLE patients (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  medicaid_member_id TEXT,  -- encrypted; blind-index column omitted for brevity
  first_name         TEXT NOT NULL,
  last_name          TEXT NOT NULL,
  date_of_birth      DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_patients_org ON patients (organization_id);

CREATE TABLE service_authorizations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  service_code     TEXT NOT NULL,
  description      TEXT,
  address_line1    TEXT,
  address_line2    TEXT,
  city             TEXT,
  state            TEXT,
  postal_code      TEXT,
  latitude         NUMERIC(9,6),
  longitude        NUMERIC(9,6),
  radius_meters    INTEGER NOT NULL DEFAULT 150,
  authorized_units INTEGER,
  start_date       DATE NOT NULL,
  end_date         DATE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_radius_positive CHECK (radius_meters > 0),
  CONSTRAINT chk_lat CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
  CONSTRAINT chk_lng CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX idx_auth_org_patient_active ON service_authorizations (organization_id, patient_id, is_active);

-- -----------------------------------------------------------------------------
-- 4. DEVICE TRUST
-- -----------------------------------------------------------------------------
CREATE TABLE devices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id        TEXT NOT NULL,
  fingerprint_hash TEXT,
  platform         device_platform NOT NULL DEFAULT 'WEB',
  os_version       TEXT,
  browser          TEXT,
  app_version      TEXT,
  last_ip_address  INET,
  trust_level      device_trust_level NOT NULL DEFAULT 'UNKNOWN',
  is_emulator      BOOLEAN NOT NULL DEFAULT FALSE,
  is_rooted        BOOLEAN NOT NULL DEFAULT FALSE,
  is_jailbroken    BOOLEAN NOT NULL DEFAULT FALSE,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, device_id)
);
CREATE INDEX idx_devices_org_trust ON devices (organization_id, trust_level);
CREATE INDEX idx_devices_fingerprint ON devices (fingerprint_hash);

-- -----------------------------------------------------------------------------
-- 5. VISITS (PARTITIONED MONTHLY BY scheduled_start)
-- -----------------------------------------------------------------------------
CREATE TABLE visits (
  id                  UUID NOT NULL DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id         UUID NOT NULL REFERENCES providers(id),
  caregiver_id        UUID NOT NULL REFERENCES caregivers(id),
  patient_id          UUID NOT NULL REFERENCES patients(id),
  authorization_id    UUID REFERENCES service_authorizations(id),
  device_id           UUID REFERENCES devices(id),
  service_code        TEXT,
  status              visit_status NOT NULL DEFAULT 'SCHEDULED',
  scheduled_start     TIMESTAMPTZ NOT NULL,
  scheduled_end       TIMESTAMPTZ,
  clock_in_at         TIMESTAMPTZ,
  clock_out_at        TIMESTAMPTZ,
  duration_minutes    INTEGER,
  clock_in_lat        NUMERIC(9,6),
  clock_in_lng        NUMERIC(9,6),
  billed_units        INTEGER,
  billed_amount_cents INTEGER,
  verification_result verification_result,
  risk_score          INTEGER DEFAULT 0,
  risk_level          risk_level,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, scheduled_start),
  CONSTRAINT chk_visit_risk CHECK (risk_score BETWEEN 0 AND 100)
) PARTITION BY RANGE (scheduled_start);

CREATE INDEX idx_visits_org_status   ON visits (organization_id, status);
CREATE INDEX idx_visits_org_sched    ON visits (organization_id, scheduled_start);
CREATE INDEX idx_visits_caregiver    ON visits (caregiver_id, scheduled_start);
CREATE INDEX idx_visits_patient      ON visits (patient_id, scheduled_start);
CREATE INDEX idx_visits_provider     ON visits (provider_id, scheduled_start);

-- Example partitions (CI/ops create rolling partitions via pg_partman or cron).
CREATE TABLE visits_2026_05 PARTITION OF visits
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE visits_2026_06 PARTITION OF visits
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE visits_2026_07 PARTITION OF visits
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
-- Catch-all so inserts never fail if a partition is missing.
CREATE TABLE visits_default PARTITION OF visits DEFAULT;

-- -----------------------------------------------------------------------------
-- 6. VERIFICATION CHAIN (append-only evidence)
-- -----------------------------------------------------------------------------
CREATE TABLE visit_verifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_id        UUID NOT NULL UNIQUE,
  result          verification_result NOT NULL,
  risk_score      INTEGER NOT NULL DEFAULT 0,
  risk_level      risk_level NOT NULL DEFAULT 'LOW',
  chain           JSONB NOT NULL DEFAULT '{}',
  evidence_hash   TEXT,
  approved_by_id  UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vv_org_result ON visit_verifications (organization_id, result);

CREATE TABLE identity_verifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_id         UUID,
  caregiver_id     UUID NOT NULL REFERENCES caregivers(id),
  method           identity_method NOT NULL DEFAULT 'SELFIE',
  result           verification_result NOT NULL,
  confidence_score NUMERIC(5,4),
  liveness_score   NUMERIC(5,4),
  probe_s3_key     TEXT,
  matcher          TEXT,
  reasons          JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_idv_org_result ON identity_verifications (organization_id, result);
CREATE INDEX idx_idv_caregiver  ON identity_verifications (caregiver_id, created_at);

CREATE TABLE gps_verifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_id        UUID NOT NULL,
  latitude        NUMERIC(9,6) NOT NULL,
  longitude       NUMERIC(9,6) NOT NULL,
  accuracy_meters NUMERIC(7,2),
  distance_meters NUMERIC(10,2),
  result          verification_result NOT NULL,
  captured_at     TIMESTAMPTZ NOT NULL,
  event_type      TEXT NOT NULL DEFAULT 'CLOCK_IN',
  raw_payload     JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gps_org_result ON gps_verifications (organization_id, result);
CREATE INDEX idx_gps_visit      ON gps_verifications (visit_id, captured_at);

CREATE TABLE device_verifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_id        UUID,
  device_id       UUID NOT NULL REFERENCES devices(id),
  result          verification_result NOT NULL,
  trust_level     device_trust_level NOT NULL,
  ip_address      INET,
  signals         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dv_org_result ON device_verifications (organization_id, result);

-- -----------------------------------------------------------------------------
-- 7. FRAUD INTELLIGENCE
-- -----------------------------------------------------------------------------
CREATE TABLE fraud_cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_number     TEXT NOT NULL,
  title           TEXT NOT NULL,
  status          case_status NOT NULL DEFAULT 'OPEN',
  priority        case_priority NOT NULL DEFAULT 'MEDIUM',
  risk_level      risk_level NOT NULL DEFAULT 'MODERATE',
  provider_id     UUID REFERENCES providers(id),
  assignee_id     UUID REFERENCES users(id),
  exposure_cents  INTEGER,
  summary         TEXT,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, case_number)
);
CREATE INDEX idx_cases_org_status ON fraud_cases (organization_id, status, priority);
CREATE INDEX idx_cases_assignee   ON fraud_cases (assignee_id);

CREATE TABLE fraud_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_id         UUID,
  case_id          UUID REFERENCES fraud_cases(id) ON DELETE SET NULL,
  type             fraud_event_type NOT NULL,
  status           fraud_event_status NOT NULL DEFAULT 'OPEN',
  severity         INTEGER NOT NULL DEFAULT 0,
  risk_level       risk_level NOT NULL DEFAULT 'LOW',
  explanation      TEXT,
  evidence         JSONB NOT NULL DEFAULT '{}',
  detector         TEXT,
  detector_version TEXT,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_severity CHECK (severity BETWEEN 0 AND 100)
);
CREATE INDEX idx_fe_org_type_status ON fraud_events (organization_id, type, status);
CREATE INDEX idx_fe_org_detected    ON fraud_events (organization_id, detected_at);
CREATE INDEX idx_fe_case            ON fraud_events (case_id);

CREATE TABLE case_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES fraud_cases(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_case ON case_notes (case_id, created_at);

CREATE TABLE case_evidence (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      UUID NOT NULL REFERENCES fraud_cases(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  kind         TEXT NOT NULL,
  ref_id       TEXT,
  s3_key       TEXT,
  content_hash TEXT,
  added_by_id  UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidence_case ON case_evidence (case_id);

CREATE TABLE fraud_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subject_type    score_subject_type NOT NULL,
  subject_id      UUID NOT NULL,
  score           INTEGER NOT NULL,
  risk_level      risk_level NOT NULL,
  factors         JSONB NOT NULL DEFAULT '[]',
  model_version   TEXT,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_score CHECK (score BETWEEN 0 AND 100)
);
CREATE INDEX idx_scores_subject ON fraud_scores (organization_id, subject_type, subject_id, computed_at DESC);

CREATE TABLE provider_risk_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id          UUID NOT NULL UNIQUE REFERENCES providers(id) ON DELETE CASCADE,
  current_score        INTEGER NOT NULL DEFAULT 0,
  risk_level           risk_level NOT NULL DEFAULT 'LOW',
  verification_failures INTEGER NOT NULL DEFAULT 0,
  gps_anomalies        INTEGER NOT NULL DEFAULT 0,
  billing_anomalies    INTEGER NOT NULL DEFAULT 0,
  identity_issues      INTEGER NOT NULL DEFAULT 0,
  open_cases           INTEGER NOT NULL DEFAULT 0,
  substantiated_cases  INTEGER NOT NULL DEFAULT 0,
  trend                JSONB NOT NULL DEFAULT '[]',
  last_computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_risk_org_level ON provider_risk_profiles (organization_id, risk_level);

-- -----------------------------------------------------------------------------
-- 8. REPORTING, NOTIFICATIONS, AUDIT
-- -----------------------------------------------------------------------------
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            report_type NOT NULL,
  format          report_format NOT NULL DEFAULT 'PDF',
  status          report_status NOT NULL DEFAULT 'QUEUED',
  parameters      JSONB NOT NULL DEFAULT '{}',
  s3_key          TEXT,
  requested_by_id UUID REFERENCES users(id),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_reports_org_type ON reports (organization_id, type, status);

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  channel         notification_channel NOT NULL DEFAULT 'IN_APP',
  status          notification_status NOT NULL DEFAULT 'PENDING',
  title           TEXT NOT NULL,
  body            TEXT,
  data            JSONB NOT NULL DEFAULT '{}',
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_org_user ON notifications (organization_id, user_id, status);

-- Audit log: partitioned monthly, append-only, tamper-evident hash chain.
CREATE TABLE audit_logs (
  id              UUID NOT NULL DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  actor_id        UUID,
  action          audit_action NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT,
  ip_address      INET,
  user_agent      TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  prev_hash       TEXT,
  hash            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_audit_org_created   ON audit_logs (organization_id, created_at);
CREATE INDEX idx_audit_org_resource  ON audit_logs (organization_id, resource_type, resource_id);
CREATE INDEX idx_audit_actor         ON audit_logs (actor_id);

CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_logs_2026_07 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;

-- -----------------------------------------------------------------------------
-- 9. IMMUTABILITY + TAMPER-EVIDENCE TRIGGERS
-- -----------------------------------------------------------------------------
-- Block UPDATE/DELETE on append-only evidence tables.
CREATE OR REPLACE FUNCTION rv_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only; % is not permitted',
    TG_TABLE_NAME, TG_OP USING ERRCODE = 'integrity_constraint_violation';
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_idv_immutable BEFORE UPDATE OR DELETE ON identity_verifications
  FOR EACH ROW EXECUTE FUNCTION rv_forbid_mutation();
CREATE TRIGGER trg_gps_immutable BEFORE UPDATE OR DELETE ON gps_verifications
  FOR EACH ROW EXECUTE FUNCTION rv_forbid_mutation();
CREATE TRIGGER trg_dv_immutable BEFORE UPDATE OR DELETE ON device_verifications
  FOR EACH ROW EXECUTE FUNCTION rv_forbid_mutation();
CREATE TRIGGER trg_fe_immutable BEFORE UPDATE OR DELETE ON fraud_events
  FOR EACH ROW EXECUTE FUNCTION rv_forbid_mutation();

-- Audit hash chain: hash = SHA256(prev_hash || canonical(row)). Per-tenant chain.
CREATE OR REPLACE FUNCTION rv_audit_hash_chain() RETURNS trigger AS $$
DECLARE
  v_prev TEXT;
BEGIN
  SELECT hash INTO v_prev
    FROM audit_logs
    WHERE organization_id = NEW.organization_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

  NEW.prev_hash := v_prev;
  NEW.hash := encode(
    digest(
      coalesce(v_prev,'') ||
      NEW.organization_id::text || coalesce(NEW.actor_id::text,'') ||
      NEW.action::text || NEW.resource_type || coalesce(NEW.resource_id,'') ||
      NEW.metadata::text || NEW.created_at::text,
      'sha256'
    ), 'hex');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_hash BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION rv_audit_hash_chain();

CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION rv_forbid_mutation();

-- generic updated_at maintenance
CREATE OR REPLACE FUNCTION rv_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_org_touch     BEFORE UPDATE ON organizations  FOR EACH ROW EXECUTE FUNCTION rv_touch_updated_at();
CREATE TRIGGER trg_user_touch    BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION rv_touch_updated_at();
CREATE TRIGGER trg_provider_touch BEFORE UPDATE ON providers     FOR EACH ROW EXECUTE FUNCTION rv_touch_updated_at();
CREATE TRIGGER trg_case_touch    BEFORE UPDATE ON fraud_cases    FOR EACH ROW EXECUTE FUNCTION rv_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 10. ROW-LEVEL SECURITY (hard multi-tenant isolation)
-- The app sets `SET app.current_org = '<uuid>'` per request/transaction.
-- A privileged migration/ops role bypasses RLS (BYPASSRLS).
-- -----------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','roles','providers','caregivers','patients','service_authorizations',
    'devices','visits','visit_verifications','identity_verifications',
    'gps_verifications','device_verifications','fraud_events','fraud_cases',
    'fraud_scores','provider_risk_profiles','reports','notifications','audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %I
      USING (organization_id = current_setting('app.current_org', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);
    $p$, t);
  END LOOP;
END $$;

-- =============================================================================
-- END SCHEMA
-- =============================================================================
