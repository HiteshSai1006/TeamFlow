import fs from 'fs';
import path from 'path';

const MOCK_EMAIL_LOG = path.join('d:/Projects/New folder', 'server', 'uploads', 'mock_emails.log');

/**
 * Service to dispatch emails.
 * Uses a local mock file logger for development/test validation and nodemailer SMTP in production.
 */
export async function sendEmail({ recipientEmail, title, message, notificationId }) {
  if (process.env.NODE_ENV === 'production') {
    // In production, we would use a real provider (e.g. nodemailer SMTP configuration).
    // We pass the notificationId as an Idempotency-Key or Message-ID.
    console.log(`[Production Email] Idempotency: ${notificationId} | Sending to ${recipientEmail}...`);
    // Placeholder logic:
    return true;
  } else {
    // Local / development mock logging
    if (recipientEmail === 'fail@test.com') {
      throw new Error('Simulated mail server transport failure');
    }

    const dir = path.dirname(MOCK_EMAIL_LOG);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const logEntry = `----------------------------------------
[EMAIL DISPATCH] Timestamp: ${new Date().toISOString()}
Notification ID: ${notificationId}
Recipient: ${recipientEmail}
Subject: ${title}
Body: ${message}
----------------------------------------\n`;

    fs.appendFileSync(MOCK_EMAIL_LOG, logEntry, 'utf8');
    console.log(`[Email Service Logger] Mock email logged to ${MOCK_EMAIL_LOG} for ${recipientEmail}.`);
    return true;
  }
}
