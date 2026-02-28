-- SLA / TAT engine schema additions (reference migration for PostgreSQL deployments)
-- Existing in-flight cases must retain their computed due dates when tenant SLA config changes.

CREATE TABLE IF NOT EXISTS tenant_sla_config (
  id UUID PRIMARY KEY,
  tenantId UUID NOT NULL,
  caseType VARCHAR NULL,
  tatDurationMinutes INT NOT NULL,
  businessStartTime TIME NOT NULL,
  businessEndTime TIME NOT NULL,
  workingDays INT[] NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_sla_config_tenant_case_type
  ON tenant_sla_config (tenantId, caseType);

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS slaDueAt TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS tatTotalMinutes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tatPaused BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tatLastStartedAt TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS tatAccumulatedMinutes INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cases_tenant_sla_due_at
  ON cases (tenantId, slaDueAt);
