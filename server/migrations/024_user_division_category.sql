-- Migration 024: Add division_category column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS division_category VARCHAR(100) NULL AFTER division;
