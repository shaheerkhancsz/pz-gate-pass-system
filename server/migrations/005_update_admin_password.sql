-- Update admin user password to plain text
UPDATE users 
SET password = 'adminpass'
WHERE email = 'admin@agp.com.pk'; 