-- Migration 013: Add code and logo columns to companies table
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS code VARCHAR(20) NULL AFTER short_name,
  ADD COLUMN IF NOT EXISTS logo TEXT        NULL AFTER code;
