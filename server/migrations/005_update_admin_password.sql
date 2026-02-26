-- Update admin user password to plain text
UPDATE users 
SET password = 'adminpass'
WHERE email = 'admin@parazelsus.pk'; 