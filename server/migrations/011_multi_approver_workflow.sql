-- ============================================================
-- Migration 011: Multi-Approver Workflow Redesign
-- ============================================================
-- 1. Rename hod_approved status → approved in existing data
-- 2. Add security_remarks column to gate_passes
-- 3. Add approved_by / approved_at columns (replacing hod_approved_by/at)
-- 4. Create gate_pass_approvals tracking table (for ALL mode)
-- 5. Create approval_settings table (per-department approver config)
-- ============================================================

-- Step 1: Rename hod_approved → approved in existing rows
UPDATE gate_passes SET status = 'approved' WHERE status = 'hod_approved';

-- Step 2: Add new columns to gate_passes
ALTER TABLE gate_passes
  ADD COLUMN IF NOT EXISTS security_remarks TEXT NULL AFTER remarks,
  ADD COLUMN IF NOT EXISTS approved_by INT NULL AFTER security_remarks,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL AFTER approved_by;

-- Step 3: Migrate existing hod_approved_by / hod_approved_at into new columns
UPDATE gate_passes
SET
  approved_by  = hod_approved_by,
  approved_at  = hod_approved_at
WHERE hod_approved_by IS NOT NULL OR hod_approved_at IS NOT NULL;

-- Step 4: Create gate_pass_approvals table (per-approver tracking for ALL mode)
CREATE TABLE IF NOT EXISTS gate_pass_approvals (
  id            INT           NOT NULL AUTO_INCREMENT,
  gate_pass_id  INT           NOT NULL,
  user_id       INT           NOT NULL,
  approved_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gpa (gate_pass_id, user_id),
  CONSTRAINT fk_gpa_gatepass FOREIGN KEY (gate_pass_id) REFERENCES gate_passes (id) ON DELETE CASCADE,
  CONSTRAINT fk_gpa_user     FOREIGN KEY (user_id)      REFERENCES users (id)       ON DELETE CASCADE
);

-- Step 5: Create approval_settings table (who can approve per department)
CREATE TABLE IF NOT EXISTS approval_settings (
  id            INT           NOT NULL AUTO_INCREMENT,
  company_id    INT           NOT NULL,
  department    VARCHAR(100)  NOT NULL,
  user_id       INT           NOT NULL,
  mode          ENUM('any','all') NOT NULL DEFAULT 'any',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_as (company_id, department, user_id),
  CONSTRAINT fk_as_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
  CONSTRAINT fk_as_user    FOREIGN KEY (user_id)    REFERENCES users (id)     ON DELETE CASCADE
);
