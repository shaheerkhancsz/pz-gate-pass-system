"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
async function testPassword() {
    const password = 'CSZ786@';
    const storedHash = '$2b$10$.lixsjhYndj1aLhN4JmI4u/bFBUHuk6lnp1nyetVJL./s.7J99IL.';
    console.log('Testing password:', password);
    console.log('Stored hash:', storedHash);
    // Test comparison
    const isMatch = await bcrypt_1.default.compare(password, storedHash);
    console.log('Password matches:', isMatch);
    // Generate new hash
    const newHash = await bcrypt_1.default.hash(password, 10);
    console.log('New hash:', newHash);
    // Verify new hash
    const newHashMatch = await bcrypt_1.default.compare(password, newHash);
    console.log('New hash matches:', newHashMatch);
}
testPassword().catch(console.error);
