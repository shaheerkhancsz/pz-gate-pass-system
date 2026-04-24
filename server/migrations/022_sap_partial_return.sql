-- Migration 022: SAP Reference Code + Partial Return Tracking
-- Issue #4: SAP reference code generated when gate pass is completed/force-closed
-- Issue #11: Partial return tracking per item for returnable gate passes

-- Add SAP reference code column to gate_passes table
ALTER TABLE gate_passes
  ADD COLUMN sap_reference_code VARCHAR(30) NULL UNIQUE AFTER force_close_remarks;

-- Add received_quantity column to items table for partial return tracking
ALTER TABLE items
  ADD COLUMN received_quantity INT NOT NULL DEFAULT 0 AFTER unit;
