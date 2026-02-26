import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { db } from '../db';
import * as schema from '@shared/schema';
import { and, eq, inArray, isNull, lte } from 'drizzle-orm';

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

interface WhatsAppConfig {
  phoneNumberId: string; // Meta Business phone number ID
  accessToken: string;   // Meta Graph API permanent access token
}

interface NotificationSettings {
  emailEnabled: boolean;
  emailConfig: EmailConfig;
  smsEnabled: boolean;
  smsConfig: SmsConfig;
  whatsappEnabled: boolean;
  whatsappConfig: WhatsAppConfig;
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
  },
  whatsappEnabled: false,
  whatsappConfig: {
    phoneNumberId: '',
    accessToken: '',
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
      try {
        // If value is already an object or a string, parse and merge with defaults
        const raw = typeof settings[0].value === 'string'
          ? JSON.parse(settings[0].value)
          : settings[0].value;
        // Merge with defaults so any newly-added fields (e.g. whatsapp) are always present
        return {
          ...defaultSettings,
          ...raw,
          emailConfig: { ...defaultSettings.emailConfig, ...(raw.emailConfig || {}) },
          smsConfig: { ...defaultSettings.smsConfig, ...(raw.smsConfig || {}) },
          whatsappConfig: { ...defaultSettings.whatsappConfig, ...(raw.whatsappConfig || {}) },
        } as NotificationSettings;
      } catch (parseError) {
        console.error('Error parsing notification settings:', parseError);
        // If parsing fails, delete the invalid settings
        try {
          await db.delete(schema.companySettings)
            .where(eq(schema.companySettings.key, 'notificationSettings'));
        } catch (deleteError) {
          console.error('Error deleting invalid settings:', deleteError);
        }
      }
    }
    
    // If no settings found or parsing failed, return defaults
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
    // Ensure settings match the expected format
    const validatedSettings: NotificationSettings = {
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
      },
      whatsappEnabled: Boolean(settings.whatsappEnabled),
      whatsappConfig: {
        phoneNumberId: String(settings.whatsappConfig?.phoneNumberId || ''),
        accessToken: String(settings.whatsappConfig?.accessToken || ''),
      },
    };

    // First, delete any existing settings
    await db.delete(schema.companySettings)
      .where(eq(schema.companySettings.key, 'notificationSettings'));
    
    // Then insert new settings
    await db.insert(schema.companySettings).values({
      key: 'notificationSettings',
      value: validatedSettings // Drizzle ORM should handle the JSON serialization
    });
    
    return true;
  } catch (error) {
    console.error('Error saving notification settings:', error);
    return false;
  }
}

/**
 * Create test email account using Ethereal
 */
async function createTestEmailAccount() {
  const testAccount = await nodemailer.createTestAccount();
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
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
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
      const testAccount = await nodemailer.createTestAccount();
      console.log('Ethereal test account created:', {
        user: testAccount.user,
        pass: testAccount.pass,
        smtp: {
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure
        }
      });
      
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        },
        debug: true
      });
    } else {
      console.log('Using custom SMTP configuration:', {
        host: settings.emailConfig.host,
        port: settings.emailConfig.port,
        secure: settings.emailConfig.secure
      });
      
      transporter = nodemailer.createTransport({
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
    (transporter as any).set('timeout', 10000); // 10 seconds timeout
    
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
      previewUrl: useEthereal ? nodemailer.getTestMessageUrl(info) : undefined
    });

    if (useEthereal) {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        code: (error as any).code,
        command: (error as any).command
      });
    }
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

// =============================================
// Phase 4: Workflow Notification Helpers
// =============================================

/**
 * Find users who have a specific module+action permission, optionally filtered by department.
 * Returns email, fullName, and phone for each matching user.
 */
async function getUsersWithPermission(
  module: string,
  action: string,
  department?: string
): Promise<Array<{ email: string; fullName: string; phone: string | null }>> {
  try {
    const permRows = await db
      .select({ roleId: schema.permissions.roleId })
      .from(schema.permissions)
      .where(
        and(
          eq(schema.permissions.module, module as any),
          eq(schema.permissions.action, action as any)
        )
      );

    if (permRows.length === 0) return [];

    const roleIds = [...new Set(permRows.map(p => p.roleId).filter(Boolean))] as number[];

    const conditions: any[] = [inArray(schema.users.roleId, roleIds)];
    if (department) {
      conditions.push(eq(schema.users.department, department));
    }

    return await db
      .select({ email: schema.users.email, fullName: schema.users.fullName, phone: schema.users.phoneNumber })
      .from(schema.users)
      .where(and(...conditions));
  } catch (error) {
    console.error('Error looking up users with permission:', error);
    return [];
  }
}

/**
 * Convert a Pakistani-format phone number to WhatsApp-compatible international format.
 * e.g. 0306-2228391 → 923062228391
 */
function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0')) return '92' + digits.slice(1);
  return digits;
}

/**
 * Send a WhatsApp message via the Meta Graph API.
 */
export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  try {
    const settings = await getNotificationSettings();

    if (!settings.whatsappEnabled) {
      console.log('WhatsApp notifications are disabled');
      return false;
    }

    const { phoneNumberId, accessToken } = settings.whatsappConfig;
    if (!phoneNumberId || !accessToken) {
      console.log('WhatsApp not configured: missing phoneNumberId or accessToken');
      return false;
    }

    const formattedTo = formatPhoneForWhatsApp(to);

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedTo,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      console.error('WhatsApp API error:', err);
      return false;
    }

    const result = await response.json() as any;
    console.log('WhatsApp message sent:', result?.messages?.[0]?.id);
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

// --- WhatsApp text message builders ---

function buildWhatsAppNewPassMessage(gatePass: any): string {
  return `*AGP Gate Pass — Action Required*\n\nA new gate pass requires your approval.\n\n• *Pass No:* ${gatePass.gatePassNumber}\n• *Department:* ${gatePass.department}\n• *Customer:* ${gatePass.customerName}\n• *Submitted by:* ${gatePass.createdBy}\n\nPlease log in to the Gate Pass System to review.`;
}

function buildWhatsAppDecisionMessage(gatePass: any, action: string, actorName: string, remarks?: string): string {
  const labels: Record<string, string> = {
    approved:  '✅ HOD Approved',
    rejected:  '❌ Rejected',
    sent_back: '↩️ Sent Back for Revision',
  };
  const label = labels[action] || action;
  let msg = `*AGP Gate Pass — ${label}*\n\nGate pass *${gatePass.gatePassNumber}* has been actioned by ${actorName}.\n\n• *Status:* ${label}\n• *Customer:* ${gatePass.customerName}`;
  if (remarks) msg += `\n• *Remarks:* ${remarks}`;
  if (action === 'sent_back') msg += '\n\nPlease review the remarks, update your gate pass, and resubmit.';
  return msg;
}

function buildWhatsAppSecurityMessage(gatePass: any): string {
  return `*AGP Gate Pass — Security Clearance Required*\n\nGate pass *${gatePass.gatePassNumber}* is HOD-approved and awaiting your clearance.\n\n• *Department:* ${gatePass.department}\n• *Customer:* ${gatePass.customerName}\n• *Driver:* ${gatePass.driverName}\n• *Vehicle:* ${gatePass.deliveryVanNumber || 'N/A'}\n\nPlease verify and allow through the gate.`;
}

function buildWhatsAppResubmittedMessage(gatePass: any): string {
  return `*AGP Gate Pass — Resubmitted for Review*\n\nGate pass *${gatePass.gatePassNumber}* has been revised by ${gatePass.createdBy} and resubmitted for your approval.\n\n• *Department:* ${gatePass.department}\n• *Customer:* ${gatePass.customerName}\n\nPlease log in to the Gate Pass System to review.`;
}

// --- Email template builders ---

function baseEmailWrapper(title: string, body: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden;">
      <div style="background: #1a3c6e; padding: 20px 24px;">
        <h2 style="color: #fff; margin: 0; font-size: 18px;">AGP Pharma — Gate Pass System</h2>
      </div>
      <div style="padding: 24px;">
        <h3 style="margin-top: 0; color: #1a3c6e;">${title}</h3>
        ${body}
      </div>
      <div style="background: #f5f5f5; padding: 12px 24px; font-size: 11px; color: #888; text-align: center;">
        This is an automated message. Please do not reply to this email.
      </div>
    </div>`;
}

function passInfoBlock(gatePass: any): string {
  const typeLabels: Record<string, string> = { outward: 'Outward', inward: 'Inward', returnable: 'Returnable' };
  const passType = typeLabels[gatePass.type] || gatePass.type || 'Outward';
  return `
    <table style="width:100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      <tr><td style="padding: 6px 8px; background:#f9f9f9; color:#555; width:40%;">Pass Number</td><td style="padding: 6px 8px;"><strong>${gatePass.gatePassNumber}</strong></td></tr>
      <tr><td style="padding: 6px 8px; background:#f0f0f0; color:#555;">Type</td><td style="padding: 6px 8px;">${passType}</td></tr>
      <tr><td style="padding: 6px 8px; background:#f9f9f9; color:#555;">Department</td><td style="padding: 6px 8px;">${gatePass.department}</td></tr>
      <tr><td style="padding: 6px 8px; background:#f0f0f0; color:#555;">Customer / Recipient</td><td style="padding: 6px 8px;">${gatePass.customerName}</td></tr>
      <tr><td style="padding: 6px 8px; background:#f9f9f9; color:#555;">Submitted By</td><td style="padding: 6px 8px;">${gatePass.createdBy}</td></tr>
      <tr><td style="padding: 6px 8px; background:#f0f0f0; color:#555;">Date</td><td style="padding: 6px 8px;">${new Date(gatePass.date).toLocaleDateString('en-PK')}</td></tr>
    </table>`;
}

function buildNewPassHodEmail(gatePass: any): string {
  return baseEmailWrapper(
    `New Gate Pass Submitted — Awaiting Your Approval`,
    `<p>A new gate pass has been submitted in your department and requires your review.</p>
    ${passInfoBlock(gatePass)}
    <p style="margin-top: 16px; padding: 12px; background: #fff8e1; border-left: 4px solid #ffc107; font-size: 13px; color: #555;">
      Please log in to the Gate Pass System to approve, reject, or send back this pass.
    </p>`
  );
}

function buildHodDecisionEmail(gatePass: any, action: string, actorName: string, remarks?: string): string {
  const configs: Record<string, { label: string; color: string; icon: string }> = {
    approved:  { label: 'HOD Approved', color: '#1976d2', icon: '✅' },
    rejected:  { label: 'Rejected',     color: '#c62828', icon: '❌' },
    sent_back: { label: 'Sent Back for Revision', color: '#e65100', icon: '↩️' },
  };
  const cfg = configs[action] || { label: action, color: '#333', icon: '📋' };

  const remarksBlock = remarks
    ? `<p style="margin-top: 16px; padding: 12px; background: #fff3e0; border-left: 4px solid #ff9800; font-size: 13px; color: #555;">
        <strong>Remarks from ${actorName}:</strong><br/>${remarks}
       </p>`
    : '';

  return baseEmailWrapper(
    `${cfg.icon} Gate Pass ${cfg.label}`,
    `<p>Your gate pass has been <strong style="color:${cfg.color};">${cfg.label.toLowerCase()}</strong> by <strong>${actorName}</strong>.</p>
    ${passInfoBlock(gatePass)}
    ${remarksBlock}
    ${action === 'sent_back' ? '<p>Please log in, review the remarks, update your gate pass, and resubmit.</p>' : ''}`
  );
}

function buildSecurityNotificationEmail(gatePass: any): string {
  return baseEmailWrapper(
    `Gate Pass HOD-Approved — Awaiting Your Clearance`,
    `<p>The following gate pass has been approved by HOD and is now awaiting security clearance.</p>
    ${passInfoBlock(gatePass)}
    <p style="margin-top: 16px; padding: 12px; background: #e8f5e9; border-left: 4px solid #4caf50; font-size: 13px; color: #555;">
      Please verify the items and driver details before allowing the vehicle/personnel through the gate.
    </p>`
  );
}

function buildResubmittedHodEmail(gatePass: any): string {
  return baseEmailWrapper(
    `Gate Pass Resubmitted for Review`,
    `<p>The following gate pass has been revised by the initiator and resubmitted for your approval.</p>
    ${passInfoBlock(gatePass)}`
  );
}

function buildOverduePassEmail(passes: any[]): string {
  const rows = passes.map(p =>
    `<tr>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${p.gatePassNumber}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${p.customerName}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; color:#c62828;">${new Date(p.expectedReturnDate).toLocaleDateString('en-PK')}</td>
    </tr>`
  ).join('');

  const tableHtml = `
    <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:12px;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px; text-align:left; border-bottom:2px solid #ddd;">Pass No.</th>
          <th style="padding:8px; text-align:left; border-bottom:2px solid #ddd;">Customer</th>
          <th style="padding:8px; text-align:left; border-bottom:2px solid #ddd;">Expected Return</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  return baseEmailWrapper(
    `⚠️ Overdue Returnable Gate Pass Alert`,
    `<p>The following returnable gate ${passes.length === 1 ? 'pass has' : 'passes have'} exceeded the expected return date and ${passes.length === 1 ? 'has' : 'have'} not yet been marked as returned.</p>
    ${tableHtml}
    <p style="margin-top: 16px; padding: 12px; background: #fce4ec; border-left: 4px solid #e91e63; font-size: 13px; color: #555;">
      Please follow up with the concerned party and update the gate pass status in the system.
    </p>`
  );
}

// --- Exported notification functions ---

/**
 * Notify HOD users (with gatePass:approve permission in the same department) of a new pass submission.
 */
export async function notifyHodOfNewPass(gatePass: any): Promise<void> {
  try {
    const hodUsers = await getUsersWithPermission('gatePass', 'approve', gatePass.department);
    if (hodUsers.length === 0) return;

    const subject = `New Gate Pass Requires Approval — #${gatePass.gatePassNumber}`;
    const html = buildNewPassHodEmail(gatePass);
    const whatsappMsg = buildWhatsAppNewPassMessage(gatePass);

    await Promise.allSettled([
      ...hodUsers.map(u => sendEmail(u.email, subject, html)),
      ...hodUsers.filter(u => u.phone).map(u => sendWhatsApp(u.phone!, whatsappMsg)),
    ]);
  } catch (error) {
    console.error('notifyHodOfNewPass error:', error);
  }
}

/**
 * Notify the pass initiator of the HOD's decision (approved / rejected / sent_back).
 */
export async function notifyInitiatorOfHodDecision(
  gatePass: any,
  action: 'approved' | 'rejected' | 'sent_back',
  actorName: string,
  remarks?: string
): Promise<void> {
  try {
    const [creator] = await db
      .select({ email: schema.users.email, phone: schema.users.phoneNumber })
      .from(schema.users)
      .where(eq(schema.users.id, gatePass.createdById))
      .limit(1);

    if (!creator) return;

    const actionLabel: Record<string, string> = {
      approved:  'HOD Approved',
      rejected:  'Rejected',
      sent_back: 'Sent Back for Revision',
    };
    const subject = `Gate Pass #${gatePass.gatePassNumber} — ${actionLabel[action] || action}`;
    const html = buildHodDecisionEmail(gatePass, action, actorName, remarks);
    const whatsappMsg = buildWhatsAppDecisionMessage(gatePass, action, actorName, remarks);

    await Promise.allSettled([
      creator.email ? sendEmail(creator.email, subject, html) : Promise.resolve(false),
      creator.phone ? sendWhatsApp(creator.phone, whatsappMsg) : Promise.resolve(false),
    ]);
  } catch (error) {
    console.error('notifyInitiatorOfHodDecision error:', error);
  }
}

/**
 * Notify security users (with gatePass:verify permission) that a pass is HOD-approved and ready for clearance.
 */
export async function notifySecurityOfApprovedPass(gatePass: any): Promise<void> {
  try {
    const securityUsers = await getUsersWithPermission('gatePass', 'verify');
    if (securityUsers.length === 0) return;

    const subject = `Gate Pass Ready for Security Clearance — #${gatePass.gatePassNumber}`;
    const html = buildSecurityNotificationEmail(gatePass);
    const whatsappMsg = buildWhatsAppSecurityMessage(gatePass);

    await Promise.allSettled([
      ...securityUsers.map(u => sendEmail(u.email, subject, html)),
      ...securityUsers.filter(u => u.phone).map(u => sendWhatsApp(u.phone!, whatsappMsg)),
    ]);
  } catch (error) {
    console.error('notifySecurityOfApprovedPass error:', error);
  }
}

/**
 * Notify HOD users that a previously sent-back pass has been resubmitted.
 */
export async function notifyHodOfResubmission(gatePass: any): Promise<void> {
  try {
    const hodUsers = await getUsersWithPermission('gatePass', 'approve', gatePass.department);
    if (hodUsers.length === 0) return;

    const subject = `Gate Pass Resubmitted for Approval — #${gatePass.gatePassNumber}`;
    const html = buildResubmittedHodEmail(gatePass);
    const whatsappMsg = buildWhatsAppResubmittedMessage(gatePass);

    await Promise.allSettled([
      ...hodUsers.map(u => sendEmail(u.email, subject, html)),
      ...hodUsers.filter(u => u.phone).map(u => sendWhatsApp(u.phone!, whatsappMsg)),
    ]);
  } catch (error) {
    console.error('notifyHodOfResubmission error:', error);
  }
}

/**
 * Check for overdue returnable passes and send alert emails to their creators.
 * Returns the count of creators notified.
 */
export async function checkAndNotifyOverduePasses(): Promise<{ notified: number; overdueCount: number }> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const allPasses = await db
      .select()
      .from(schema.gatePasses)
      .where(
        and(
          eq((schema.gatePasses as any).type, 'returnable'),
          isNull((schema.gatePasses as any).actualReturnDate),
          lte((schema.gatePasses as any).expectedReturnDate, today)
        )
      );

    const overduePasses = allPasses.filter(
      p => !['completed', 'rejected'].includes(p.status)
    );

    if (overduePasses.length === 0) return { notified: 0, overdueCount: 0 };

    // Group by creator so each creator gets one consolidated email
    const byCreator = new Map<number, typeof overduePasses>();
    for (const pass of overduePasses) {
      const list = byCreator.get(pass.createdById) || [];
      list.push(pass);
      byCreator.set(pass.createdById, list);
    }

    let notified = 0;
    for (const [creatorId, passes] of byCreator) {
      const [creator] = await db
        .select({ email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, creatorId))
        .limit(1);

      if (!creator?.email) continue;

      const subject = `Overdue Returnable Gate Pass Alert — ${passes.length} Pass${passes.length > 1 ? 'es' : ''} Overdue`;
      const html = buildOverduePassEmail(passes);

      await sendEmail(creator.email, subject, html).catch(() => {});
      notified++;
    }

    return { notified, overdueCount: overduePasses.length };
  } catch (error) {
    console.error('checkAndNotifyOverduePasses error:', error);
    return { notified: 0, overdueCount: 0 };
  }
}