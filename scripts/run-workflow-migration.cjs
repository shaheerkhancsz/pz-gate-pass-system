#!/usr/bin/env node
// scripts/run-workflow-migration.cjs
// Run: node scripts/run-workflow-migration.cjs

const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

async function main() {
    const conn = await mysql.createConnection(
        process.env.DATABASE_URL || "mysql://root:@127.0.0.1:3306/pz_gate_pass"
    );

    try {
        console.log("▶ Running migration 011: Multi-Approver Workflow…");
        const sql = fs.readFileSync(
            path.join(__dirname, "../server/migrations/011_multi_approver_workflow.sql"),
            "utf8"
        );

        // Split on semicolon, filter blanks/comments-only blocks
        const statements = sql
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && !s.startsWith("--"));

        for (const stmt of statements) {
            console.log("  →", stmt.split("\n")[0].substring(0, 80));
            await conn.execute(stmt);
        }

        console.log("✅ Migration 011 applied successfully.");
    } catch (err) {
        console.error("❌ Migration failed:", err.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

main();
