-- Migration 026: Add reason column to gate_passes table
ALTER TABLE gate_passes ADD COLUMN IF NOT EXISTS reason TEXT NULL AFTER notes;
