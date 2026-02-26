import { createPool } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log('Connecting to database with URL:', process.env.DATABASE_URL);

// Create the connection pool for MySQL
export const pool = createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the database connection
pool.query('SELECT CURRENT_TIMESTAMP')
  .then(([rows]) => {
    console.log('Database connected successfully at:', rows);
  })
  .catch((err) => {
    console.error('Error connecting to the database:', err);
  });

// Add error handler for connection issues
// pool.on('error', (err) => {
//   console.error('Unexpected error on idle client:', err);
//   process.exit(-1);
// });

export const db = drizzle(pool, { schema, mode: 'default' });
