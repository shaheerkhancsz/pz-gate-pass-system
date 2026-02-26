"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationSettings = getNotificationSettings;
exports.saveNotificationSettings = saveNotificationSettings;
exports.sendEmail = sendEmail;
exports.sendSMS = sendSMS;
exports.generateGatePassUpdateEmail = generateGatePassUpdateEmail;
exports.generateGatePassUpdateSMS = generateGatePassUpdateSMS;
var nodemailer_1 = require("nodemailer");
var twilio_1 = require("twilio");
var db_1 = require("../db");
var schema = require("@shared/schema");
var drizzle_orm_1 = require("drizzle-orm");
// Default empty configuration
var defaultSettings = {
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
function getNotificationSettings() {
    return __awaiter(this, void 0, void 0, function () {
        var settings, parseError_1, deleteError_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 9, , 10]);
                    return [4 /*yield*/, db_1.db.select().from(schema.companySettings).where((0, drizzle_orm_1.eq)(schema.companySettings.key, 'notificationSettings')).limit(1)];
                case 1:
                    settings = _a.sent();
                    if (!(settings.length > 0 && settings[0].value)) return [3 /*break*/, 8];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 3, , 8]);
                    // If value is already an object, return it
                    if (typeof settings[0].value === 'object') {
                        return [2 /*return*/, settings[0].value];
                    }
                    // If value is a string, try to parse it
                    if (typeof settings[0].value === 'string') {
                        return [2 /*return*/, JSON.parse(settings[0].value)];
                    }
                    return [3 /*break*/, 8];
                case 3:
                    parseError_1 = _a.sent();
                    console.error('Error parsing notification settings:', parseError_1);
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, db_1.db.delete(schema.companySettings)
                            .where((0, drizzle_orm_1.eq)(schema.companySettings.key, 'notificationSettings'))];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 7];
                case 6:
                    deleteError_1 = _a.sent();
                    console.error('Error deleting invalid settings:', deleteError_1);
                    return [3 /*break*/, 7];
                case 7: return [3 /*break*/, 8];
                case 8: 
                // If no settings found or parsing failed, return defaults
                return [2 /*return*/, defaultSettings];
                case 9:
                    error_1 = _a.sent();
                    console.error('Error fetching notification settings:', error_1);
                    return [2 /*return*/, defaultSettings];
                case 10: return [2 /*return*/];
            }
        });
    });
}
/**
 * Save notification settings to database
 */
function saveNotificationSettings(settings) {
    return __awaiter(this, void 0, void 0, function () {
        var validatedSettings, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    validatedSettings = {
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
                    return [4 /*yield*/, db_1.db.delete(schema.companySettings)
                            .where((0, drizzle_orm_1.eq)(schema.companySettings.key, 'notificationSettings'))];
                case 1:
                    // First, delete any existing settings
                    _a.sent();
                    // Then insert new settings
                    return [4 /*yield*/, db_1.db.insert(schema.companySettings).values({
                            key: 'notificationSettings',
                            value: validatedSettings // Drizzle ORM should handle the JSON serialization
                        })];
                case 2:
                    // Then insert new settings
                    _a.sent();
                    return [2 /*return*/, true];
                case 3:
                    error_2 = _a.sent();
                    console.error('Error saving notification settings:', error_2);
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Create test email account using Ethereal
 */
function createTestEmailAccount() {
    return __awaiter(this, void 0, void 0, function () {
        var testAccount;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, nodemailer_1.default.createTestAccount()];
                case 1:
                    testAccount = _a.sent();
                    console.log('Test Email Account:', {
                        user: testAccount.user,
                        pass: testAccount.pass,
                        smtp: {
                            host: testAccount.smtp.host,
                            port: testAccount.smtp.port,
                            secure: testAccount.smtp.secure
                        }
                    });
                    return [2 /*return*/, testAccount];
            }
        });
    });
}
/**
 * Send email notification
 */
function sendEmail(to, subject, html) {
    return __awaiter(this, void 0, void 0, function () {
        var settings, transporter, useEthereal, testAccount, info, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 7, , 8]);
                    return [4 /*yield*/, getNotificationSettings()];
                case 1:
                    settings = _a.sent();
                    if (!settings.emailEnabled) {
                        console.log('Email notifications are disabled');
                        return [2 /*return*/, false];
                    }
                    transporter = void 0;
                    useEthereal = !settings.emailConfig.host || !settings.emailConfig.auth.user;
                    if (!useEthereal) return [3 /*break*/, 3];
                    console.log('Creating Ethereal test account...');
                    return [4 /*yield*/, nodemailer_1.default.createTestAccount()];
                case 2:
                    testAccount = _a.sent();
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
                    return [3 /*break*/, 4];
                case 3:
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
                    _a.label = 4;
                case 4:
                    // Set a reasonable timeout
                    transporter.set('timeout', 10000); // 10 seconds timeout
                    console.log('Verifying transporter configuration...');
                    return [4 /*yield*/, transporter.verify()];
                case 5:
                    _a.sent();
                    console.log('Transporter verified successfully');
                    console.log('Sending email...');
                    return [4 /*yield*/, transporter.sendMail({
                            from: useEthereal ?
                                '"Gate Pass System Test" <test@ethereal.email>' :
                                "\"Gate Pass System\" <".concat(settings.emailConfig.auth.user, ">"),
                            to: to,
                            subject: subject,
                            html: html
                        })];
                case 6:
                    info = _a.sent();
                    console.log('Email sent successfully:', {
                        messageId: info.messageId,
                        previewUrl: useEthereal ? nodemailer_1.default.getTestMessageUrl(info) : undefined
                    });
                    if (useEthereal) {
                        console.log('Preview URL:', nodemailer_1.default.getTestMessageUrl(info));
                    }
                    return [2 /*return*/, true];
                case 7:
                    error_3 = _a.sent();
                    console.error('Error sending email:', error_3);
                    if (error_3 instanceof Error) {
                        console.error('Error details:', {
                            message: error_3.message,
                            name: error_3.name,
                            stack: error_3.stack,
                            code: error_3.code,
                            command: error_3.command
                        });
                    }
                    return [2 /*return*/, false];
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * Send SMS notification
 */
function sendSMS(to, body) {
    return __awaiter(this, void 0, void 0, function () {
        var settings, smsConfig, client, message, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, getNotificationSettings()];
                case 1:
                    settings = _a.sent();
                    if (!settings.smsEnabled) {
                        console.log('SMS notifications are disabled');
                        return [2 /*return*/, false];
                    }
                    smsConfig = settings.smsConfig;
                    client = (0, twilio_1.default)(smsConfig.accountSid, smsConfig.authToken);
                    return [4 /*yield*/, client.messages.create({
                            body: body,
                            from: smsConfig.phoneNumber,
                            to: to
                        })];
                case 2:
                    message = _a.sent();
                    console.log('SMS sent:', message.sid);
                    return [2 /*return*/, true];
                case 3:
                    error_4 = _a.sent();
                    console.error('Error sending SMS:', error_4);
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Generate email template for gate pass updates
 */
function generateGatePassUpdateEmail(gatePass) {
    return "\n    <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;\">\n      <h2 style=\"color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;\">Gate Pass Update</h2>\n      <p>Gate Pass <strong>".concat(gatePass.gatePassNumber, "</strong> has been updated.</p>\n      <p>Current Status: <strong>").concat(gatePass.status.toUpperCase(), "</strong></p>\n      \n      <div style=\"margin-top: 20px; background-color: #f9f9f9; padding: 15px; border-radius: 5px;\">\n        <h3 style=\"margin-top: 0; color: #555;\">Gate Pass Details</h3>\n        <p><strong>Customer:</strong> ").concat(gatePass.customerName, "</p>\n        <p><strong>Department:</strong> ").concat(gatePass.department, "</p>\n        <p><strong>Date:</strong> ").concat(new Date(gatePass.date).toLocaleDateString(), "</p>\n        <p><strong>Updated By:</strong> ").concat(gatePass.updatedBy || gatePass.createdBy, "</p>\n      </div>\n      \n      <div style=\"margin-top: 30px; font-size: 0.8em; color: #888; text-align: center;\">\n        <p>This is an automated message from the Parazelsus Gate Pass System.</p>\n      </div>\n    </div>\n  ");
}
/**
 * Generate SMS template for gate pass updates
 */
function generateGatePassUpdateSMS(gatePass) {
    return "Parazelsus Gate Pass Update: ".concat(gatePass.gatePassNumber, " is now ").concat(gatePass.status.toUpperCase(), ". Driver: ").concat(gatePass.driverName, ". Contact: ").concat(gatePass.driverMobile, ".");
}
