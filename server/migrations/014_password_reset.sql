-- Migration 014: Add password reset token fields to users table
-- Used by Phase 10: Forgot Password / Self-Service Reset

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255) NULL AFTER password,
  ADD COLUMN IF NOT EXISTS password_reset_expiry DATETIME     NULL AFTER password_reset_token;

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (password_reset_token);
