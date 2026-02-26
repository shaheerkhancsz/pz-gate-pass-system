-- Enable the pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migration: Hash existing passwords
BEGIN;

-- Create a temporary table to store hashed passwords
CREATE TEMP TABLE temp_passwords AS
SELECT 
    id,
    email,
    crypt(password, gen_salt('bf')) as hashed_password
FROM users;

-- Update the users table with hashed passwords
UPDATE users u
SET password = t.hashed_password
FROM temp_passwords t
WHERE u.id = t.id;

-- Drop the temporary table
DROP TABLE temp_passwords;

-- Commit the transaction
COMMIT; 