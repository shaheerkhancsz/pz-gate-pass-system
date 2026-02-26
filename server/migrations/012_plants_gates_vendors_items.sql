-- ================================================================
-- Migration 012: Plants, Gates, Vendors, Item Master, Extra Fields
-- Phase A: Plants Management
-- Phase B: Gates Management  
-- Phase C: Vendors/Suppliers
-- Phase D: Item Master Catalogue
-- Phase E: Additional Fields (dept code, division, SAP codes)
-- ================================================================

-- PHASE A: Plants
CREATE TABLE IF NOT EXISTS plants (
  id          INT           NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)  NOT NULL,   -- e.g. AG01, AG02
  company_id  INT           NOT NULL,
  description VARCHAR(255)  NULL,
  active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plant (company_id, name),
  CONSTRAINT fk_plant_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
);

-- PHASE B: Gates
CREATE TABLE IF NOT EXISTS gates (
  id          INT           NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)  NOT NULL,   -- e.g. Gate-1, Gate-2
  plant_id    INT           NULL,       -- optional, linked to plant
  company_id  INT           NOT NULL,
  description VARCHAR(255)  NULL,
  active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_gate_plant   FOREIGN KEY (plant_id)   REFERENCES plants    (id) ON DELETE SET NULL,
  CONSTRAINT fk_gate_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
);

-- Add gate_id to gate_passes
ALTER TABLE gate_passes
  ADD COLUMN IF NOT EXISTS gate_id INT NULL AFTER company_id,
  ADD CONSTRAINT fk_gp_gate FOREIGN KEY (gate_id) REFERENCES gates (id) ON DELETE SET NULL;

-- PHASE C: Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id          INT           NOT NULL AUTO_INCREMENT,
  code        VARCHAR(50)   NULL,
  name        VARCHAR(255)  NOT NULL,
  company_id  INT           NOT NULL,
  phone       VARCHAR(30)   NULL,
  email       VARCHAR(255)  NULL,
  address     TEXT          NULL,
  sap_code    VARCHAR(50)   NULL,
  active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_vendor_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
);

-- PHASE D: Item Master
CREATE TABLE IF NOT EXISTS item_master (
  id          INT           NOT NULL AUTO_INCREMENT,
  code        VARCHAR(50)   NULL,        -- SAP item code
  name        VARCHAR(255)  NOT NULL,
  type        VARCHAR(100)  NULL,        -- e.g. Assets, Raw Material, Finished Goods
  plant_id    INT           NULL,
  company_id  INT           NOT NULL,
  unit        VARCHAR(50)   NULL,        -- e.g. PCS, KG, LTR
  active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_im_plant   FOREIGN KEY (plant_id)   REFERENCES plants   (id) ON DELETE SET NULL,
  CONSTRAINT fk_im_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
);

-- PHASE E: Additional Fields
-- Department code
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS code VARCHAR(30) NULL AFTER name;

-- Employee division + SAP code
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS division       VARCHAR(100) NULL AFTER department,
  ADD COLUMN IF NOT EXISTS sap_employee_code VARCHAR(50) NULL AFTER division;

-- Customer SAP code (customers stored in gate_passes as name/phone — need separate customers table check)
-- Add sap_code to vendors already done above
-- Customers table if it exists
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS sap_code VARCHAR(50) NULL
  -- only runs if table exists; silently fails if already there
;
