const mysql = require('mysql2/promise');

async function migrate() {
    const conn = await mysql.createConnection('mysql://root:@127.0.0.1:3306/pz_gate_pass');

    // 1. Add new columns to gate_passes
    const [existing] = await conn.execute('SHOW COLUMNS FROM gate_passes');
    const existingCols = existing.map(c => c.Field);

    const newCols = [
        { name: 'remarks', sql: 'ALTER TABLE gate_passes ADD COLUMN remarks TEXT NULL' },
        { name: 'hod_approved_by', sql: 'ALTER TABLE gate_passes ADD COLUMN hod_approved_by INT NULL' },
        { name: 'hod_approved_at', sql: 'ALTER TABLE gate_passes ADD COLUMN hod_approved_at TIMESTAMP NULL' },
        { name: 'security_allowed_by', sql: 'ALTER TABLE gate_passes ADD COLUMN security_allowed_by INT NULL' },
        { name: 'security_allowed_at', sql: 'ALTER TABLE gate_passes ADD COLUMN security_allowed_at TIMESTAMP NULL' },
        { name: 'sap_reference_code', sql: 'ALTER TABLE gate_passes ADD COLUMN sap_reference_code VARCHAR(100) NULL' },
    ];

    for (const col of newCols) {
        if (!existingCols.includes(col.name)) {
            await conn.execute(col.sql);
            console.log('✅ Added ' + col.name + ' column');
        } else {
            console.log('ℹ️  ' + col.name + ' already exists');
        }
    }

    // 2. Seed HOD and Security Guard roles
    const [roles] = await conn.execute('SELECT name FROM roles');
    const roleNames = roles.map(r => r.name);

    if (!roleNames.includes('HOD')) {
        await conn.execute("INSERT INTO roles (name, description) VALUES ('HOD', 'Head of Department - approves/rejects gate passes')");
        console.log('✅ Created HOD role');
    } else {
        console.log('ℹ️  HOD role already exists');
    }

    if (!roleNames.includes('Security Guard')) {
        await conn.execute("INSERT INTO roles (name, description) VALUES ('Security Guard', 'Gate security - allows exit after HOD approval')");
        console.log('✅ Created Security Guard role');
    } else {
        console.log('ℹ️  Security Guard role already exists');
    }

    // 3. Verify
    const [allCols] = await conn.execute('SHOW COLUMNS FROM gate_passes');
    console.log('\nGate passes columns:', allCols.map(c => c.Field));
    const [allRoles] = await conn.execute('SELECT id, name FROM roles');
    console.log('All roles:', allRoles);

    await conn.end();
    console.log('\n✅ Phase 2 migration complete!');
}

migrate().catch(console.error);
