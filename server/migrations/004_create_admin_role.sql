-- Create admin role if it doesn't exist
INSERT INTO roles (name, description, is_default)
VALUES ('Admin', 'Administrator role with full access', true)
ON CONFLICT (name) DO NOTHING; 