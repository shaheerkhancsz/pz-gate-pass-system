-- Migration 015: Add report_templates table for Custom Report Builder
CREATE TABLE IF NOT EXISTS report_templates (
  id          INT           NOT NULL AUTO_INCREMENT,
  name        VARCHAR(255)  NOT NULL,
  description TEXT          NULL,
  config      JSON          NOT NULL,
  user_id     INT           NOT NULL,
  company_id  INT           NULL,
  is_shared   BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_rt_user    FOREIGN KEY (user_id)    REFERENCES users     (id) ON DELETE CASCADE,
  CONSTRAINT fk_rt_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rt_user_id    ON report_templates (user_id);
CREATE INDEX IF NOT EXISTS idx_rt_company_id ON report_templates (company_id);
