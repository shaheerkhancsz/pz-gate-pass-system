-- Migration 020: Add extra fields to companies table for Company Settings page
ALTER TABLE companies
  ADD COLUMN full_name VARCHAR(255) NULL AFTER name,
  ADD COLUMN tagline VARCHAR(255) NULL AFTER full_name,
  ADD COLUMN website VARCHAR(255) NULL AFTER email,
  ADD COLUMN footer_text TEXT NULL AFTER website;
