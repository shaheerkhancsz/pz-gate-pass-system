
import fs from 'fs';
import readline from 'readline';
import { createPool } from 'mysql2/promise';
import 'dotenv/config';

// Database connection
const pool = createPool({
    uri: process.env.DATABASE_URL,
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const BACKUP_FILE = 'backup.sql';

// Map PG table names to MySQL table names if needed
// Most are same, but checking schema...
const TABLE_MAP: Record<string, string> = {
    'public.roles': 'roles',
    'public.users': 'users',
    'public.permissions': 'permissions',
    'public.customers': 'customers',
    'public.drivers': 'drivers',
    'public.gate_passes': 'gate_passes',
    'public.items': 'items',
    'public.user_activity_logs': 'user_activity_logs',
    'public.documents': 'documents',
    'public.notifications': 'notifications',
    'public.company_settings': 'company_settings',
    // Skip public.session as schema differs and sessions are transient
};

// Dependency order for insertion to avoid FK errors
const INSERT_ORDER = [
    'roles',
    'users',
    'permissions',
    'customers',
    'drivers',
    'gate_passes',
    'items',
    'user_activity_logs',
    'documents',
    'notifications',
    'company_settings'
];

async function migrate() {
    console.log('Starting migration...');

    // 1. Disable Foreign Key Checks
    console.log('Disabling FK checks...');
    await pool.query('SET FOREIGN_KEY_CHECKS = 0;');

    // Truncate tables to insure clean state
    console.log('Truncating tables...');

    // Ensure documents table has LONGTEXT for file_data to support large imports
    try {
        await pool.query('ALTER TABLE documents MODIFY COLUMN file_data LONGTEXT');
        console.log('Altered documents.file_data to LONGTEXT');
    } catch (e: any) {
        console.warn('Could not alter documents table:', e.message);
    }

    for (const table of [...INSERT_ORDER].reverse()) {
        await pool.query(`TRUNCATE TABLE \`${table}\``);
    }

    const fileStream = fs.createReadStream(BACKUP_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let currentTable: string | null = null;
    let columns: string[] = [];

    // Store data in memory grouped by table to insert in correct order
    const tableData: Record<string, { columns: string[], rows: any[][] }> = {};

    // Helper to unescape PostgreSQL COPY format
    function unescapePostgresCopy(val: string): string {
        return val.replace(/\\([0-7]{3}|[^0-7])/g, (match, p1) => {
            if (/^[0-7]{3}$/.test(p1)) {
                return String.fromCharCode(parseInt(p1, 8));
            }
            switch (p1) {
                case 'b': return '\b';
                case 'f': return '\f';
                case 'n': return '\n';
                case 'r': return '\r';
                case 't': return '\t';
                case 'v': return '\v';
                case '\\': return '\\';
                default: return p1;
            }
        });
    }


    for await (const line of rl) {
        if (line.startsWith('COPY public.')) {
            // Parse COPY header: COPY public.tablename (col1, col2) FROM stdin;
            const match = line.match(/COPY public\.(\w+) \((.*)\) FROM stdin;/);
            if (match) {
                const tableName = 'public.' + match[1];
                if (TABLE_MAP[tableName]) {
                    currentTable = TABLE_MAP[tableName];
                    columns = match[2].split(', ').map(c => c.trim().replace(/"/g, '')); // Remove quotes if any
                    tableData[currentTable] = { columns, rows: [] };
                    console.log(`Found data for table: ${currentTable}`);
                } else {
                    console.log(`Skipping table: ${tableName}`);
                    currentTable = null;
                }
            }
        } else if (line.trim() === '\\.') {
            currentTable = null;
        } else if (currentTable) {
            // Parse data line (tab separated)
            const values = line.split('\t').map(val => {
                if (val === '\\N') return null;

                let cleanedVal = unescapePostgresCopy(val);

                // Convert boolean t/f to 1/0
                if (cleanedVal === 't') return 1;
                if (cleanedVal === 'f') return 0;

                // Handle specific JSON column unquoting/cleanup if needed
                // PostgreSQL might assume json is a string, if it starts/ends with quotes due to COPY
                // But unescapePostgresCopy usually handles the content escaping. 
                // We leave it as string, MySQL driver handles the rest if mapped to specific type? 
                // No, mysql2 driver expects primitive values. 

                return cleanedVal;
            });
            tableData[currentTable].rows.push(values);
        }
    }

    // Insert data in order
    for (const table of INSERT_ORDER) {
        if (!tableData[table]) {
            console.log(`No data found for ${table}, skipping...`);
            continue;
        }

        let { columns, rows } = tableData[table];
        if (rows.length === 0) continue;

        // Pre-process roles to handle case-insensitive duplicate names (e.g. 'admin' vs 'Admin')
        if (table === 'roles') {
            const nameIdx = columns.indexOf('name');
            const idIdx = columns.indexOf('id');
            if (nameIdx !== -1 && idIdx !== -1) {
                const seenNames = new Set<string>();
                rows = rows.map(row => {
                    let name = row[nameIdx];
                    const lowerName = String(name).toLowerCase();
                    if (seenNames.has(lowerName)) {
                        console.log(`Renaming duplicate role '${name}' to '${name}_${row[idIdx]}'`);
                        row[nameIdx] = `${name}_${row[idIdx]}`;
                    }
                    seenNames.add(lowerName);
                    return row;
                });
            }
        }

        console.log(`Inserting ${rows.length} rows into ${table}...`);

        // Batch insert
        const BATCH_SIZE = 1000;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);

            // Process specific table data adjustments
            const processedBatch = batch.map(row => {
                if (table === 'gate_passes') {
                    // Map columns to indices
                    const colMap: Record<string, number> = {};
                    columns.forEach((col, idx) => colMap[col] = idx);

                    const custIdIdx = colMap['customer_id'];
                    if (custIdIdx !== undefined && row[custIdIdx] === null) row[custIdIdx] = 0;

                    const drvIdIdx = colMap['driver_id'];
                    if (drvIdIdx !== undefined && row[drvIdIdx] === null) row[drvIdIdx] = 0;
                }
                return row;
            });


            const placeholders = processedBatch.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');

            // Flatten batch for query
            const flatValues = processedBatch.flat();

            const escapedColumns = columns.map(c => `\`${c}\``).join(', ');
            const query = `INSERT INTO \`${table}\` (${escapedColumns}) VALUES ${placeholders}`;

            try {
                await pool.query(query, flatValues);
            } catch (e: any) {
                console.error(`Error inserting into ${table}:`, e.message);
                throw e;
            }
        }
    }

    // Re-enable FK checks
    await pool.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('Migration complete!');
    process.exit(0);
}

migrate().catch(console.error);
