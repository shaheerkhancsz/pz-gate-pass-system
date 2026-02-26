-- =============================================================
-- Phase 5: SAP ERP Integration
-- =============================================================

-- 1. Add SAP configuration columns to companies table
ALTER TABLE companies
  ADD COLUMN sap_enabled     BOOLEAN      NOT NULL DEFAULT FALSE     COMMENT 'Whether SAP integration is enabled for this company',
  ADD COLUMN sap_base_url    VARCHAR(500) NULL                       COMMENT 'SAP system base URL, e.g. https://my-sap.example.com',
  ADD COLUMN sap_username    VARCHAR(100) NULL                       COMMENT 'SAP basic-auth username',
  ADD COLUMN sap_password    VARCHAR(255) NULL                       COMMENT 'SAP basic-auth password (store encrypted in production)',
  ADD COLUMN sap_client_id   VARCHAR(10)  NULL                       COMMENT 'SAP mandant/client number, e.g. 100',
  ADD COLUMN last_sap_sync_at TIMESTAMP   NULL                       COMMENT 'Timestamp of the last successful SAP sync';

-- 2. Add SAP sync tracking to customers
ALTER TABLE customers
  ADD COLUMN sap_id          VARCHAR(100) NULL                       COMMENT 'SAP Business Partner number',
  ADD COLUMN synced_from_sap BOOLEAN      NOT NULL DEFAULT FALSE     COMMENT 'Whether this record was synced from SAP',
  ADD UNIQUE INDEX idx_customers_sap_id (sap_id);

-- 3. Add SAP sync tracking to drivers
ALTER TABLE drivers
  ADD COLUMN sap_id          VARCHAR(100) NULL                       COMMENT 'SAP vendor/driver ID',
  ADD COLUMN synced_from_sap BOOLEAN      NOT NULL DEFAULT FALSE     COMMENT 'Whether this record was synced from SAP',
  ADD UNIQUE INDEX idx_drivers_sap_id (sap_id);

-- 4. Create products table (SAP-sourced materials catalog)
CREATE TABLE IF NOT EXISTS products (
  id                INT          NOT NULL AUTO_INCREMENT,
  company_id        INT          NULL,
  name              VARCHAR(255) NOT NULL,
  sku               VARCHAR(100) NULL,
  description       TEXT         NULL,
  unit              VARCHAR(50)  NULL                                COMMENT 'Unit of measure, e.g. EA, KG, L',
  sap_material_code VARCHAR(100) NULL                               COMMENT 'SAP material number',
  synced_from_sap   BOOLEAN      NOT NULL DEFAULT FALSE,
  active            BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_products_company (company_id),
  UNIQUE INDEX idx_products_sap_code (company_id, sap_material_code),
  CONSTRAINT fk_products_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);
