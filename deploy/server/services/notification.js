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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationSettings = getNotificationSettings;
exports.saveNotificationSettings = saveNotificationSettings;
exports.sendEmail = sendEmail;
exports.sendSMS = sendSMS;
exports.generateGatePassUpdateEmail = generateGatePassUpdateEmail;
exports.generateGatePassUpdateSMS = generateGatePassUpdateSMS;
const nodemailer_1 = __importDefault(require("nodemailer"));
const twilio_1 = __importDefault(require("twilio"));
const db_1 = require("../db");
const schema = __importStar(require("../../shared/schema"));
const drizzle_orm_1 = require("drizzle-orm");
// Default empty configuration
const defaultSettings = {
    emailEnabled: false,
    emailConfig: {
        host: '',
        port: 587,
        secure: false,
        auth: {
            user: '',
            pass: ''
        }
    },
    smsEnabled: false,
    smsConfig: {
        accountSid: '',
        authToken: '',
        phoneNumber: ''
    }
};
/**
 * Get notification settings from database
 */
async function getNotificationSettings() {
    try {
        // Try to get settings from database
        const settings = await db_1.db.select().from(schema.companySettings).where((0, drizzle_orm_1.eq)(schema.companySettings.key, 'notificationSettings')).limit(1);
        if (settings.length > 0 && settings[0].value) {
            try {
                // If value is already an object, return it
                if (typeof settings[0].value === 'object') {
                    return settings[0].value;
                }
                // If value is a string, try to parse it
                if (typeof settings[0].value === 'string') {
                    return JSON.parse(settings[0].value);
                }
            }
            catch (parseError) {
                console.error('Error parsing notification settings:', parseError);
                // If parsing fails, delete the invalid settings
                try {
                    await db_1.db.delete(schema.companySettings)
                        .where((0, drizzle_orm_1.eq)(schema.companySettings.key, 'notificationSettings'));
                }
                catch (deleteError) {
                    console.error('Error deleting invalid settings:', deleteError);
                }
            }
        }
        // If no settings found or parsing failed, return defaults
        return defaultSettings;
    }
    catch (error) {
        console.error('Error fetching notification settings:', error);
        return defaultSettings;
    }
}
/**
 * Save notification settings to database
 */
async function saveNotificationSettings(settings) {
    try {
        // Ensure settings match the expected format
        const validatedSettings = {
            emailEnabled: Boolean(settings.emailEnabled),
            emailConfig: {
                host: String(settings.emailConfig.host || ''),
                port: Number(settings.emailConfig.port || 587),
                secure: Boolean(settings.emailConfig.secure),
                auth: {
                    user: String(settings.emailConfig.auth.user || ''),
                    pass: String(settings.emailConfig.auth.pass || '')
                }
            },
            smsEnabled: Boolean(settings.smsEnabled),
            smsConfig: {
                accountSid: String(settings.smsConfig.accountSid || ''),
                authToken: String(settings.smsConfig.authToken || ''),
                phoneNumber: String(settings.smsConfig.phoneNumber || '')
            }
        };
        // First, delete any existing settings
        await db_1.db.delete(schema.companySettings)
            .where((0, drizzle_orm_1.eq)(schema.companySettings.key, 'notificationSettings'));
        // Then insert new settings
        await db_1.db.insert(schema.companySettings).values({
            key: 'notificationSettings',
            value: validatedSettings // Drizzle ORM should handle the JSON serialization
        });
        return true;
    }
    catch (error) {
        console.error('Error saving notification settings:', error);
        return false;
    }
}
/**
 * Create test email account using Ethereal
 */
async function createTestEmailAccount() {
    const testAccount = await nodemailer_1.default.createTestAccount();
    console.log('Test Email Account:', {
        user: testAccount.user,
        pass: testAccount.pass,
        smtp: {
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure
        }
    });
    return testAccount;
}
/**
 * Send email notification
 */
async function sendEmail(to, subject, html) {
    try {
        const settings = await getNotificationSettings();
        if (!settings.emailEnabled) {
            console.log('Email notifications are disabled');
            return false;
        }
        let transporter;
        let useEthereal = !settings.emailConfig.host || !settings.emailConfig.auth.user;
        if (useEthereal) {
            console.log('Creating Ethereal test account...');
            const testAccount = await nodemailer_1.default.createTestAccount();
            console.log('Ethereal test account created:', {
                user: testAccount.user,
                pass: testAccount.pass,
                smtp: {
                    host: testAccount.smtp.host,
                    port: testAccount.smtp.port,
                    secure: testAccount.smtp.secure
                }
            });
            transporter = nodemailer_1.default.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                },
                debug: true
            });
        }
        else {
            console.log('Using custom SMTP configuration:', {
                host: settings.emailConfig.host,
                port: settings.emailConfig.port,
                secure: settings.emailConfig.secure
            });
            transporter = nodemailer_1.default.createTransport({
                host: settings.emailConfig.host,
                port: settings.emailConfig.port,
                secure: settings.emailConfig.secure,
                auth: {
                    user: settings.emailConfig.auth.user,
                    pass: settings.emailConfig.auth.pass
                },
                debug: true
            });
        }
        // Set a reasonable timeout
        transporter.set('timeout', 10000); // 10 seconds timeout
        console.log('Verifying transporter configuration...');
        await transporter.verify();
        console.log('Transporter verified successfully');
        console.log('Sending email...');
        const info = await transporter.sendMail({
            from: useEthereal ?
                '"Gate Pass System Test" <test@ethereal.email>' :
                `"Gate Pass System" <${settings.emailConfig.auth.user}>`,
            to,
            subject,
            html
        });
        console.log('Email sent successfully:', {
            messageId: info.messageId,
            previewUrl: useEthereal ? nodemailer_1.default.getTestMessageUrl(info) : undefined
        });
        if (useEthereal) {
            console.log('Preview URL:', nodemailer_1.default.getTestMessageUrl(info));
        }
        return true;
    }
    catch (error) {
        console.error('Error sending email:', error);
        if (error instanceof Error) {
            console.error('Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
                code: error.code,
                command: error.command
            });
        }
        return false;
    }
}
/**
 * Send SMS notification
 */
async function sendSMS(to, body) {
    try {
        const settings = await getNotificationSettings();
        if (!settings.smsEnabled) {
            console.log('SMS notifications are disabled');
            return false;
        }
        const { smsConfig } = settings;
        // Initialize Twilio client
        const client = (0, twilio_1.default)(smsConfig.accountSid, smsConfig.authToken);
        // Send SMS
        const message = await client.messages.create({
            body,
            from: smsConfig.phoneNumber,
            to
        });
        console.log('SMS sent:', message.sid);
        return true;
    }
    catch (error) {
        console.error('Error sending SMS:', error);
        return false;
    }
}
/**
 * Generate email template for gate pass updates
 */
function generateGatePassUpdateEmail(gatePass) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">Gate Pass Update</h2>
      <p>Gate Pass <strong>${gatePass.gatePassNumber}</strong> has been updated.</p>
      <p>Current Status: <strong>${gatePass.status.toUpperCase()}</strong></p>
      
      <div style="margin-top: 20px; background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
        <h3 style="margin-top: 0; color: #555;">Gate Pass Details</h3>
        <p><strong>Customer:</strong> ${gatePass.customerName}</p>
        <p><strong>Department:</strong> ${gatePass.department}</p>
        <p><strong>Date:</strong> ${new Date(gatePass.date).toLocaleDateString()}</p>
        <p><strong>Updated By:</strong> ${gatePass.updatedBy || gatePass.createdBy}</p>
      </div>
      
      <div style="margin-top: 30px; font-size: 0.8em; color: #888; text-align: center;">
        <p>This is an automated message from the Parazelsus Gate Pass System.</p>
      </div>
    </div>
  `;
}
/**
 * Generate SMS template for gate pass updates
 */
function generateGatePassUpdateSMS(gatePass) {
    return `Parazelsus Gate Pass Update: ${gatePass.gatePassNumber} is now ${gatePass.status.toUpperCase()}. Driver: ${gatePass.driverName}. Contact: ${gatePass.driverMobile}.`;
}
