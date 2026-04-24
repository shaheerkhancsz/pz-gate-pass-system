-- Migration 021: Expand file_data column from TEXT (64 KB) to MEDIUMTEXT (16 MB)
-- This fixes document uploads failing for files larger than ~48 KB
ALTER TABLE documents MODIFY COLUMN file_data MEDIUMTEXT NOT NULL;
