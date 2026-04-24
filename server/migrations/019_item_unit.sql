-- Migration 019: Add unit column to items table
ALTER TABLE items ADD COLUMN unit VARCHAR(50) NULL AFTER quantity;
