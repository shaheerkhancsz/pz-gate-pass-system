/**
 * Migration script to create user_activity_logs table
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';

// Configure Neon to use WebSockets
neonConfig.webSocketConstructor = ws;

async function migrate() {
  try {
    console.log("Starting migration for user_activity_logs table...");
    
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
    }
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Create the user_activity_logs table if it doesn't exist
    const createTable = `
      CREATE TABLE IF NOT EXISTS user_activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        user_email TEXT NOT NULL,
        action_type TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        description TEXT,
        ip_address TEXT,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        additional_data TEXT
      );
    `;
    
    await pool.query(createTable);
    console.log("User activity logs table created successfully!");
    
    await pool.end();
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();