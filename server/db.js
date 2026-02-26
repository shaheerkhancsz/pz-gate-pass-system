"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.pool = void 0;
var promise_1 = require("mysql2/promise");
var mysql2_1 = require("drizzle-orm/mysql2");
var schema = require("@shared/schema");
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}
console.log('Connecting to database with URL:', process.env.DATABASE_URL);
// Create the connection pool for MySQL
exports.pool = promise_1.default.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
// Test the database connection
exports.pool.query('SELECT CURRENT_TIMESTAMP')
    .then(function (_a) {
    var rows = _a[0];
    console.log('Database connected successfully at:', rows);
})
    .catch(function (err) {
    console.error('Error connecting to the database:', err);
});
// Add error handler for connection issues
// pool.on('error', (err) => {
//   console.error('Unexpected error on idle client:', err);
//   process.exit(-1);
// });
exports.db = (0, mysql2_1.drizzle)(exports.pool, { schema: schema, mode: 'default' });
