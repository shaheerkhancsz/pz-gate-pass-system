-- Migration 017: Add code and active columns to customers table
-- Brings customers in line with vendors table structure

ALTER TABLE customers
  ADD COLUMN code    VARCHAR(50)  NULL AFTER company_id,
  ADD COLUMN active  BOOLEAN      NOT NULL DEFAULT TRUE AFTER updated_at;
