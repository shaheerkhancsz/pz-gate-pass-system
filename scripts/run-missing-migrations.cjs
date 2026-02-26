const mysql = require('mysql2/promise');
const fs = require('fs');

async function run() {
    const conn = await mysql.createConnection('mysql://root:@127.0.0.1:3306/pz_gate_pass');

    const result1 = await conn.execute('SHOW COLUMNS FROM companies');
    const cols = result1[0];
    const colNames = cols.map(c => c.Field);

    if (colNames.includes('sap_enabled')) {
        console.log('SAP columns already exist, skipping 008');
    } else {
        console.log('Running Phase 5 SAP migration (008)...');
        const sql = fs.readFileSync('./server/migrations/008_phase5_sap_integration.sql', 'utf8');
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
        for (const stmt of statements) {
            try {
                await conn.execute(stmt);
                console.log('OK:', stmt.substring(0, 60));
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_TABLE_EXISTS_ERROR') {
                    console.log('Skip (already exists):', stmt.substring(0, 60));
                } else {
                    console.error('Error:', e.message);
                }
            }
        }
        console.log('Phase 5 SAP migration done!');
    }

    const result2 = await conn.execute('SHOW COLUMNS FROM companies');
    const cols2 = result2[0];
    console.log('Companies columns:', cols2.map(c => c.Field));
    await conn.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
