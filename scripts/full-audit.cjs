/**
 * Comprehensive DB Audit & Auto-Fix Script
 * Checks every table and column against all migration expectations,
 * applies any missing changes automatically, and prints a full report.
 */
const mysql = require('mysql2/promise');

async function run() {
    const conn = await mysql.createConnection('mysql://root:@127.0.0.1:3306/pz_gate_pass');
    const issues = [];
    const fixed = [];

    async function getColumns(table) {
        try {
            const [rows] = await conn.execute(`SHOW COLUMNS FROM \`${table}\``);
            return rows.map(r => r.Field);
        } catch {
            return null; // table doesn't exist
        }
    }

    async function getTables() {
        const [rows] = await conn.execute("SHOW TABLES");
        return rows.map(r => Object.values(r)[0]);
    }

    async function addCol(table, col, ddl) {
        const cols = await getColumns(table);
        if (!cols) { issues.push(`Table '${table}' does not exist!`); return false; }
        if (cols.includes(col)) return true; // already exists
        try {
            await conn.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
            fixed.push(`Added ${table}.${col}`);
            return true;
        } catch (e) {
            issues.push(`Failed to add ${table}.${col}: ${e.message}`);
            return false;
        }
    }

    async function addIndex(table, indexName, ddl) {
        try {
            const [rows] = await conn.execute(`SHOW INDEX FROM \`${table}\` WHERE Key_name = '${indexName}'`);
            if (rows.length > 0) return; // already exists
            await conn.execute(`ALTER TABLE \`${table}\` ADD ${ddl}`);
            fixed.push(`Added index ${indexName} on ${table}`);
        } catch (e) {
            issues.push(`Failed to add index ${indexName} on ${table}: ${e.message}`);
        }
    }

    console.log('═══════════════════════════════════════════');
    console.log('  PZ Gate Pass — Full DB Migration Audit');
    console.log('═══════════════════════════════════════════\n');

    const tables = await getTables();
    console.log('Tables in DB:', tables.join(', '), '\n');

    // ── Phase 1: Multi-Company ──────────────────────────────────────────────────
    console.log('▶ Phase 1: Multi-Company Architecture');
    await addCol('users', 'company_id', 'company_id INT NULL REFERENCES companies(id)');
    await addCol('gate_passes', 'company_id', 'company_id INT NULL');
    await addCol('customers', 'company_id', 'company_id INT NULL');
    await addCol('drivers', 'company_id', 'company_id INT NULL');

    // ── Phase 2: Approval Workflow ──────────────────────────────────────────────
    console.log('▶ Phase 2: Approval Workflow');
    await addCol('gate_passes', 'remarks', 'remarks TEXT NULL');
    await addCol('gate_passes', 'hod_approved_by', 'hod_approved_by INT NULL');
    await addCol('gate_passes', 'hod_approved_at', 'hod_approved_at TIMESTAMP NULL');
    await addCol('gate_passes', 'security_allowed_by', 'security_allowed_by INT NULL');
    await addCol('gate_passes', 'security_allowed_at', 'security_allowed_at TIMESTAMP NULL');
    await addCol('gate_passes', 'sap_reference_code', 'sap_reference_code VARCHAR(100) NULL');

    // ── Phase 3: Gate Pass Types ────────────────────────────────────────────────
    console.log('▶ Phase 3: Gate Pass Types');
    await addCol('gate_passes', 'type', "type VARCHAR(20) NOT NULL DEFAULT 'outward'");
    await addCol('gate_passes', 'expected_return_date', 'expected_return_date DATE NULL');
    await addCol('gate_passes', 'actual_return_date', 'actual_return_date DATE NULL');

    // ── Phase 5: SAP Integration ────────────────────────────────────────────────
    console.log('▶ Phase 5: SAP Integration — companies table');
    await addCol('companies', 'sap_enabled', 'sap_enabled BOOLEAN NOT NULL DEFAULT FALSE');
    await addCol('companies', 'sap_base_url', 'sap_base_url VARCHAR(500) NULL');
    await addCol('companies', 'sap_username', 'sap_username VARCHAR(100) NULL');
    await addCol('companies', 'sap_password', 'sap_password VARCHAR(255) NULL');
    await addCol('companies', 'sap_client_id', 'sap_client_id VARCHAR(10) NULL');
    await addCol('companies', 'last_sap_sync_at', 'last_sap_sync_at TIMESTAMP NULL');

    console.log('▶ Phase 5: SAP Integration — customers table');
    await addCol('customers', 'sap_id', 'sap_id VARCHAR(100) NULL');
    await addCol('customers', 'synced_from_sap', 'synced_from_sap BOOLEAN NOT NULL DEFAULT FALSE');

    console.log('▶ Phase 5: SAP Integration — drivers table');
    await addCol('drivers', 'sap_id', 'sap_id VARCHAR(100) NULL');
    await addCol('drivers', 'synced_from_sap', 'synced_from_sap BOOLEAN NOT NULL DEFAULT FALSE');

    console.log('▶ Phase 5: SAP Integration — products table');
    if (!tables.includes('products')) {
        try {
            await conn.execute(`
        CREATE TABLE IF NOT EXISTS products (
          id                INT          NOT NULL AUTO_INCREMENT,
          company_id        INT          NULL,
          name              VARCHAR(255) NOT NULL,
          sku               VARCHAR(100) NULL,
          description       TEXT         NULL,
          unit              VARCHAR(50)  NULL,
          sap_material_code VARCHAR(100) NULL,
          synced_from_sap   BOOLEAN      NOT NULL DEFAULT FALSE,
          active            BOOLEAN      NOT NULL DEFAULT TRUE,
          created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          INDEX idx_products_company (company_id),
          CONSTRAINT fk_products_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
        )
      `);
            fixed.push('Created products table');
        } catch (e) {
            issues.push('Failed to create products table: ' + e.message);
        }
    }

    // ── Phase 6: LDAP / AD SSO ──────────────────────────────────────────────────
    console.log('▶ Phase 6: LDAP / AD SSO — companies table');
    await addCol('companies', 'ldap_enabled', 'ldap_enabled BOOLEAN NOT NULL DEFAULT FALSE');
    await addCol('companies', 'ldap_url', 'ldap_url VARCHAR(500) NULL');
    await addCol('companies', 'ldap_base_dn', 'ldap_base_dn VARCHAR(500) NULL');
    await addCol('companies', 'ldap_bind_dn', 'ldap_bind_dn VARCHAR(500) NULL');
    await addCol('companies', 'ldap_bind_password', 'ldap_bind_password VARCHAR(255) NULL');
    await addCol('companies', 'ldap_search_base', 'ldap_search_base VARCHAR(500) NULL');
    await addCol('companies', 'ldap_username_attr', "ldap_username_attr VARCHAR(100) DEFAULT 'sAMAccountName'");
    await addCol('companies', 'ldap_email_attr', "ldap_email_attr VARCHAR(100) DEFAULT 'mail'");
    await addCol('companies', 'ldap_display_name_attr', "ldap_display_name_attr VARCHAR(100) DEFAULT 'displayName'");
    await addCol('companies', 'ldap_department_attr', "ldap_department_attr VARCHAR(100) DEFAULT 'department'");
    await addCol('companies', 'ldap_phone_attr', "ldap_phone_attr VARCHAR(100) DEFAULT 'telephoneNumber'");

    // ── Rename migration ────────────────────────────────────────────────────────
    console.log('▶ Rename migration: users.name → users.full_name');
    const userCols = await getColumns('users');
    if (userCols && userCols.includes('name') && !userCols.includes('full_name')) {
        try {
            await conn.execute('ALTER TABLE users RENAME COLUMN name TO full_name');
            fixed.push('Renamed users.name to full_name');
        } catch (e) {
            issues.push('Failed to rename users.name to full_name: ' + e.message);
        }
    }

    // ── Roles check ─────────────────────────────────────────────────────────────
    console.log('▶ Checking roles');
    const [roles] = await conn.execute('SELECT id, name FROM roles ORDER BY id');
    const roleNames = roles.map(r => r.name);
    const requiredRoles = ['HOD', 'Security Guard', 'Group Admin'];
    for (const role of requiredRoles) {
        if (!roleNames.includes(role)) {
            try {
                await conn.execute('INSERT INTO roles (name, description) VALUES (?, ?)', [role, `${role} role`]);
                fixed.push(`Created role: ${role}`);
            } catch (e) {
                issues.push(`Failed to create role ${role}: ${e.message}`);
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FINAL STATE REPORT
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════');
    console.log('  FINAL TABLE SNAPSHOT');
    console.log('═══════════════════════════════════════════');

    const tableReport = ['gate_passes', 'companies', 'users', 'customers', 'drivers', 'products', 'roles'];
    for (const t of tableReport) {
        const cols = await getColumns(t);
        if (cols) {
            console.log(`\n${t} (${cols.length} cols):\n  ${cols.join(', ')}`);
        } else {
            console.log(`\n${t}: ❌ TABLE NOT FOUND`);
        }
    }

    const [rolesNow] = await conn.execute('SELECT id, name FROM roles ORDER BY id');
    console.log('\nRoles:', rolesNow.map(r => `${r.id}:${r.name}`).join(', '));

    // Summary
    console.log('\n═══════════════════════════════════════════');
    console.log('  AUDIT SUMMARY');
    console.log('═══════════════════════════════════════════');
    if (fixed.length === 0) {
        console.log('✅ No changes needed — all migrations already applied!');
    } else {
        console.log(`✅ Applied ${fixed.length} fix(es):`);
        fixed.forEach(f => console.log('  +', f));
    }
    if (issues.length === 0) {
        console.log('✅ No issues found.');
    } else {
        console.log(`⚠️  ${issues.length} issue(s) need attention:`);
        issues.forEach(i => console.log('  ⚠', i));
    }

    await conn.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
