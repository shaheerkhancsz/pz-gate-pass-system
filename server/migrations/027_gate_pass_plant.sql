-- Phase 7+: Add plant_id to gate_passes table
ALTER TABLE gate_passes
  ADD COLUMN IF NOT EXISTS plant_id INT NULL AFTER gate_id;
