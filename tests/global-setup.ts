/**
 * Global setup — runs once before all Playwright tests.
 * Sets known bcrypt passwords for all test accounts so tests can always log in.
 */
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const TEST_USERS = [
  { email: "admin@parazelsus.pk",  password: "admin123" },
  { email: "HOD@agp.com.pk",       password: "hod123"   },
  { email: "guard@agp.com.pk",     password: "guard123" },
  { email: "User@agp.com.pk",      password: "user123"  },
];

export default async function globalSetup() {
  // Parse DATABASE_URL  (mysql://user:pass@host:port/db)
  const url = new URL(process.env.DATABASE_URL!);
  const conn = await mysql.createConnection({
    host:     url.hostname,
    port:     Number(url.port) || 3306,
    user:     url.username,
    password: url.password,
    database: url.pathname.slice(1),
  });

  for (const u of TEST_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await conn.execute("UPDATE users SET password = ? WHERE email = ?", [hash, u.email]);
    console.log(`[setup] Password set for ${u.email}`);
  }

  await conn.end();
}
