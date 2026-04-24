-- Migration 018: Add code, email, active columns to drivers table
-- Brings drivers in line with vendors and customers table structure

ALTER TABLE drivers
  ADD COLUMN code   VARCHAR(50)  NULL          AFTER company_id,
  ADD COLUMN email  VARCHAR(255) NULL          AFTER vehicle_number,
  ADD COLUMN active BOOLEAN      NOT NULL DEFAULT TRUE AFTER updated_at;
