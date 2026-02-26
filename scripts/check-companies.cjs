const mysql = require('mysql2/promise');

async function run() {
    const conn = await mysql.createConnection('mysql://root:@127.0.0.1:3306/pz_gate_pass');

    const result = await conn.execute('SHOW COLUMNS FROM companies');
    const cols = result[0];
    console.log('All companies columns:');
    cols.forEach(c => console.log(' -', c.Field, ':', c.Type));

    // Also test the API call directly
    const result2 = await conn.execute('SELECT id, name, sap_enabled, ldap_enabled FROM companies LIMIT 5');
    console.log('\nCompanies data:', result2[0]);

    await conn.end();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
