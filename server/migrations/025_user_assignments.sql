-- Migration 025: User-Company, User-Plant, User-Gate assignment junction tables

CREATE TABLE IF NOT EXISTS user_companies (
  user_id INT NOT NULL,
  company_id INT NOT NULL,
  PRIMARY KEY (user_id, company_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_plants (
  user_id INT NOT NULL,
  plant_id INT NOT NULL,
  PRIMARY KEY (user_id, plant_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_gates (
  user_id INT NOT NULL,
  gate_id INT NOT NULL,
  PRIMARY KEY (user_id, gate_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (gate_id) REFERENCES gates(id) ON DELETE CASCADE
);
