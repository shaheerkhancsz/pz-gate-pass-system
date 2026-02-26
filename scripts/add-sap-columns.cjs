const mysql = require('mysql2/promise');

async function run() {
    const conn = await mysql.createConnection('mysql://root:@127.0.0.1:3306/pz_gate_pass');

    const result1 = await conn.execute('SHOW COLUMNS FROM companies');
    const colNames = result1[0].map(c => c.Field);

    const colsToAdd = [
        { name: 'sap_enabled', sql: "ALTER TABLE companies ADD COLUMN sap_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER ldap_phone_attr" },
        { name: 'sap_base_url', sql: "ALTER TABLE companies ADD COLUMN sap_base_url VARCHAR(500) NULL AFTER sap_enabled" },
        { name: 'sap_username', sql: "ALTER TABLE companies ADD COLUMN sap_username VARCHAR(100) NULL AFTER sap_base_url" },
        { name: 'sap_password', sql: "ALTER TABLE companies ADD COLUMN sap_password VARCHAR(255) NULL AFTER sap_username" },
        { name: 'sap_client_id', sql: "ALTER TABLE companies ADD COLUMN sap_client_id VARCHAR(10) NULL AFTER sap_password" },
        { name: 'last_sap_sync_at', sql: "ALTER TABLE companies ADD COLUMN last_sap_sync_at TIMESTAMP NULL AFTER sap_client_id" },
    ];

    for (const col of colsToAdd) {
        if (!colNames.includes(col.name)) {
            await conn.execute(col.sql);
            console.log('Added:', col.name);
        } else {
            console.log('Already exists:', col.name);
        }
    }

    // Also check customers and drivers for sap columns
    const result3 = await conn.execute('SHOW COLUMNS FROM customers');
    const custCols = result3[0].map(c => c.Field);
    if (!custCols.includes('sap_id')) {
        await conn.execute('ALTER TABLE customers ADD COLUMN sap_id VARCHAR(100) NULL');
        await conn.execute('ALTER TABLE customers ADD COLUMN synced_from_sap BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('Added sap_id, synced_from_sap to customers');
    }

    const result4 = await conn.execute('SHOW COLUMNS FROM drivers');
    const driverCols = result4[0].map(c => c.Field);
    if (!driverCols.includes('sap_id')) {
        await conn.execute('ALTER TABLE drivers ADD COLUMN sap_id VARCHAR(100) NULL');
        await conn.execute('ALTER TABLE drivers ADD COLUMN synced_from_sap BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('Added sap_id, synced_from_sap to drivers');
    }

    // Verify
    const result2 = await conn.execute('SHOW COLUMNS FROM companies');
    console.log('\nCompanies columns:', result2[0].map(c => c.Field));

    // Test the real query now
    const result5 = await conn.execute('SELECT id, name, sap_enabled, ldap_enabled FROM companies LIMIT 5');
    console.log('\nTest query result:', result5[0]);

    await conn.end();
    console.log('\nDone!');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
