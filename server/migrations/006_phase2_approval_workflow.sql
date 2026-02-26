-- Phase 2: Custom Approval Workflow
-- Adds approval tracking fields to gate_passes table

ALTER TABLE gate_passes
  ADD COLUMN remarks TEXT NULL COMMENT 'HOD send-back notes / rejection reason',
  ADD COLUMN hod_approved_by INT NULL,
  ADD COLUMN hod_approved_at TIMESTAMP NULL,
  ADD COLUMN security_allowed_by INT NULL,
  ADD COLUMN security_allowed_at TIMESTAMP NULL;

-- Add foreign key constraints
ALTER TABLE gate_passes
  ADD CONSTRAINT fk_hod_approved_by FOREIGN KEY (hod_approved_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_security_allowed_by FOREIGN KEY (security_allowed_by) REFERENCES users(id) ON DELETE SET NULL;
