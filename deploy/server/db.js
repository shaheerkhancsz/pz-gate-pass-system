"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.pool = void 0;
const promise_1 = require("mysql2/promise");
const mysql2_1 = require("drizzle-orm/mysql2");
const schema = __importStar(require("../shared/schema"));
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}
console.log('Connecting to database with URL:', process.env.DATABASE_URL);
// Create the connection pool for MySQL
exports.pool = (0, promise_1.createPool)({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
// Test the database connection
exports.pool.query('SELECT CURRENT_TIMESTAMP')
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
exports.db = (0, mysql2_1.drizzle)(exports.pool, { schema, mode: 'default' });
