-- Phase 7 (Feature): Dynamic Department Management
-- Creates a departments table so admins can manage departments per-company
-- instead of relying on hardcoded client-side options.

CREATE TABLE IF NOT EXISTS departments (
  id          INT          NOT NULL AUTO_INCREMENT,
  company_id  INT          NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dept_company_name (company_id, name),
  CONSTRAINT fk_dept_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Seed default departments for existing companies
-- These mirror the previous hardcoded options so existing data is consistent.
INSERT IGNORE INTO departments (company_id, name, description)
SELECT c.id, dept.name, dept.description
FROM companies c
CROSS JOIN (
  SELECT 'HO'          AS name, 'Head Office'              AS description UNION ALL
  SELECT 'Warehouse',          'Warehouse & Logistics'                     UNION ALL
  SELECT 'IT',                 'Information Technology'                    UNION ALL
  SELECT 'Finance',            'Finance & Accounts'                        UNION ALL
  SELECT 'Procurement',        'Procurement & Supply Chain'                UNION ALL
  SELECT 'Quality',            'Quality Assurance'                         UNION ALL
  SELECT 'Production',         'Production & Manufacturing'                UNION ALL
  SELECT 'HR',                 'Human Resources'
) AS dept
WHERE c.active = TRUE;
