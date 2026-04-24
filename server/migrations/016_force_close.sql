-- Migration 016: Force Close gate passes
-- Adds three columns to gate_passes to track who force-closed a pass, when, and why.

ALTER TABLE gate_passes
  ADD COLUMN force_closed_by   INT          NULL,
  ADD COLUMN force_closed_at   TIMESTAMP    NULL,
  ADD COLUMN force_close_remarks TEXT       NULL,
  ADD CONSTRAINT fk_gp_force_closed_by
    FOREIGN KEY (force_closed_by) REFERENCES users (id) ON DELETE SET NULL;
