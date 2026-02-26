-- Migration 009: Phase 6 - Active Directory (LDAP) SSO Configuration
-- Adds LDAP/AD config columns to the companies table

ALTER TABLE companies
  ADD COLUMN ldap_enabled        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN ldap_url            VARCHAR(500)         DEFAULT NULL,
  ADD COLUMN ldap_base_dn        VARCHAR(500)         DEFAULT NULL,
  ADD COLUMN ldap_bind_dn        VARCHAR(500)         DEFAULT NULL,
  ADD COLUMN ldap_bind_password  VARCHAR(255)         DEFAULT NULL,
  ADD COLUMN ldap_search_base    VARCHAR(500)         DEFAULT NULL,
  ADD COLUMN ldap_username_attr  VARCHAR(100)         DEFAULT 'sAMAccountName',
  ADD COLUMN ldap_email_attr     VARCHAR(100)         DEFAULT 'mail',
  ADD COLUMN ldap_display_name_attr VARCHAR(100)      DEFAULT 'displayName',
  ADD COLUMN ldap_department_attr   VARCHAR(100)      DEFAULT 'department',
  ADD COLUMN ldap_phone_attr        VARCHAR(100)      DEFAULT 'telephoneNumber';
