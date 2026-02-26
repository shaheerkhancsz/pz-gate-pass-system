-- Create admin user
INSERT INTO users (full_name, email, password, department, role_id, phone_number, cnic, active)
VALUES (
  'Admin User',
  'admin@parazelsus.pk',
  'adminpass',
  'HO',
  1, -- Admin role
  '0300-1234567',
  '42201-1234567-8',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  department = EXCLUDED.department,
  role_id = EXCLUDED.role_id,
  phone_number = EXCLUDED.phone_number,
  cnic = EXCLUDED.cnic,
  active = EXCLUDED.active; 