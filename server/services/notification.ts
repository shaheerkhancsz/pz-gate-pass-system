import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface SmsConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

interface NotificationSettings {
  emailEnabled: boolean;
  emailConfig: EmailConfig;
  smsEnabled: boolean;
  smsConfig: SmsConfig;
}

// Default empty configuration
const defaultSettings: NotificationSettings = {
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
export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    // Try to get settings from database
    const settings = await db.select().from(schema.companySettings).where(eq(schema.companySettings.key, 'notificationSettings')).limit(1);
    
    if (settings.length > 0 && settings[0].value) {
      return JSON.parse(settings[0].value as string) as NotificationSettings;
    }
    
    // If no settings found, return defaults
    return defaultSettings;
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return defaultSettings;
  }
}

/**
 * Save notification settings to database
 */
export async function saveNotificationSettings(settings: NotificationSettings): Promise<boolean> {
  try {
    const existingSettings = await db.select().from(schema.companySettings).where(eq(schema.companySettings.key, 'notificationSettings')).limit(1);
    
    if (existingSettings.length > 0) {
      // Update existing settings
      await db.update(schema.companySettings)
        .set({ value: JSON.stringify(settings) })
        .where(eq(schema.companySettings.key, 'notificationSettings'));
    } else {
      // Insert new settings
      await db.insert(schema.companySettings).values({
        key: 'notificationSettings',
        value: JSON.stringify(settings)
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error saving notification settings:', error);
    return false;
  }
}

/**
 * Send email notification
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const settings = await getNotificationSettings();
    
    if (!settings.emailEnabled) {
      console.log('Email notifications are disabled');
      return false;
    }
    
    const { emailConfig } = settings;
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.auth.user,
        pass: emailConfig.auth.pass
      }
    });
    
    // Send email
    const info = await transporter.sendMail({
      from: `"Parazelsus Gate Pass" <${emailConfig.auth.user}>`,
      to,
      subject,
      html
    });
    
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Send SMS notification
 */
export async function sendSMS(to: string, body: string): Promise<boolean> {
  try {
    const settings = await getNotificationSettings();
    
    if (!settings.smsEnabled) {
      console.log('SMS notifications are disabled');
      return false;
    }
    
    const { smsConfig } = settings;
    
    // Initialize Twilio client
    const client = twilio(smsConfig.accountSid, smsConfig.authToken);
    
    // Send SMS
    const message = await client.messages.create({
      body,
      from: smsConfig.phoneNumber,
      to
    });
    
    console.log('SMS sent:', message.sid);
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

/**
 * Generate email template for gate pass updates
 */
export function generateGatePassUpdateEmail(gatePass: any): string {
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
export function generateGatePassUpdateSMS(gatePass: any): string {
  return `Parazelsus Gate Pass Update: ${gatePass.gatePassNumber} is now ${gatePass.status.toUpperCase()}. Driver: ${gatePass.driverName}. Contact: ${gatePass.driverMobile}.`;
}