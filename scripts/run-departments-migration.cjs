const mysql = require('mysql2/promise');
const fs = require('fs');

async function run() {
    const conn = await mysql.createConnection('mysql://root:@127.0.0.1:3306/pz_gate_pass');

    // Step 1: Create table
    console.log('Creating departments table...');
    try {
        await conn.execute(`
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
      )
    `);
        console.log('Table created (or already existed).');
    } catch (e) {
        if (e.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log('Table already exists, skipping create.');
        } else {
            throw e;
        }
    }

    // Step 2: Seed defaults for each active company
    console.log('Seeding default departments...');
    const defaultDepts = [
        { name: 'HO', description: 'Head Office' },
        { name: 'Warehouse', description: 'Warehouse & Logistics' },
        { name: 'IT', description: 'Information Technology' },
        { name: 'Finance', description: 'Finance & Accounts' },
        { name: 'Procurement', description: 'Procurement & Supply Chain' },
        { name: 'Quality', description: 'Quality Assurance' },
        { name: 'Production', description: 'Production & Manufacturing' },
        { name: 'HR', description: 'Human Resources' },
    ];

    const compResult = await conn.execute('SELECT id, name FROM companies WHERE active = TRUE');
    const companies = compResult[0];

    for (const company of companies) {
        for (const dept of defaultDepts) {
            try {
                await conn.execute(
                    'INSERT IGNORE INTO departments (company_id, name, description) VALUES (?, ?, ?)',
                    [company.id, dept.name, dept.description]
                );
            } catch (e) {
                // ER_DUP_ENTRY means already seeded, safe to ignore
                if (e.code !== 'ER_DUP_ENTRY') console.error('Seed error:', e.message);
            }
        }
        console.log(`Departments seeded for: ${company.name}`);
    }

    // Step 3: Print final state
    const result = await conn.execute(
        'SELECT d.id, d.name, d.description, c.name AS company FROM departments d JOIN companies c ON d.company_id = c.id ORDER BY c.id, d.name'
    );
    const rows = result[0];
    console.log('\nDepartments in DB:');
    rows.forEach(r => console.log(`  [${r.company}] ${r.name} — ${r.description}`));

    await conn.end();
    console.log('\nMigration complete!');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
