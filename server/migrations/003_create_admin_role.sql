-- Create admin role if it doesn't exist
INSERT INTO roles (name, description)
VALUES ('Admin', 'Administrator role with full access')
ON CONFLICT (name) DO NOTHING; 