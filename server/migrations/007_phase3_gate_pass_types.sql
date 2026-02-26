-- Phase 3: New Gate Pass Types
-- Adds type, expectedReturnDate, actualReturnDate to gate_passes table

ALTER TABLE gate_passes
  ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'outward' COMMENT 'outward | inward | returnable',
  ADD COLUMN expected_return_date DATE NULL COMMENT 'For returnable passes: expected date of return',
  ADD COLUMN actual_return_date DATE NULL COMMENT 'For returnable passes: actual date goods were returned';
