import sgMail from '@sendgrid/mail';
import QRCode from 'qrcode';
import { loadEmailTemplate } from '../utils/templateLoader';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@example.com';
const APP_NAME = process.env.APP_NAME || 'Loyaltering';
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send welcome email after registration (fire-and-forget; errors are logged only).
 * Uses branded HTML template from email-templates/welcome.html.
 */
export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn('[emailService] SENDGRID_API_KEY not set; skipping welcome email');
    return;
  }

  const dashboardUrl = APP_URL ? `${APP_URL}/dashboard` : '#';
  const logoUrl = APP_URL ? `${APP_URL}/loyaltering-logo.svg` : '';
  const logoImgHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${escapeHtml(APP_NAME)}" width="24" height="24" style="display: block; vertical-align: middle;" />`
    : `<svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;"><path d="M36.7273 44C33.9891 44 31.6043 39.8386 30.3636 33.69C29.123 39.8386 26.7382 44 24 44C21.2618 44 18.877 39.8386 17.6364 33.69C16.3957 39.8386 14.0109 44 11.2727 44C7.25611 44 4 35.0457 4 24C4 12.9543 7.25611 4 11.2727 4C14.0109 4 16.3957 8.16144 17.6364 14.31C18.877 8.16144 21.2618 4 24 4C26.7382 4 29.123 8.16144 30.3636 14.31C31.6043 8.16144 33.9891 4 36.7273 4C40.7439 4 44 12.9543 44 24C44 35.0457 40.7439 44 36.7273 44Z" fill="#303030"/></svg>`;
  const displayName = escapeHtml(name);

  const html = loadEmailTemplate('welcome', 'html', {
    APP_NAME,
    displayName,
    dashboardUrl,
    logoImgHtml,
  });
  const text = loadEmailTemplate('welcome', 'txt', {
    name,
    APP_NAME,
    dashboardUrl,
  });

  const msg = {
    to,
    from: FROM_EMAIL,
    subject: `Welcome to ${APP_NAME}`,
    text: text || `Hi ${name},\n\nWelcome to ${APP_NAME}. Congratulations on taking the first step to increase repeat visits and build customer loyalty.\n\nGo to Dashboard: ${dashboardUrl}\n\nBest regards,\nThe ${APP_NAME} Team`,
    html:
      html ||
      `<p>Hi ${displayName},</p><p>Welcome to ${APP_NAME}. Congratulations on taking the first step to increase repeat visits and build customer loyalty.</p><p><a href="${dashboardUrl}">Go to Dashboard</a></p><p>Best regards,<br/>The ${APP_NAME} Team</p>`,
  };

  try {
    await sgMail.send(msg);
  } catch (err: any) {
    console.error('[emailService] sendWelcomeEmail failed:', err?.response?.body ?? err?.message ?? err);
  }
}

/**
 * Send password reset email with link (fire-and-forget; errors are logged only).
 * Uses email-templates/password-reset.html and .txt.
 */
export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn('[emailService] SENDGRID_API_KEY not set; skipping password reset email');
    return;
  }

  const html = loadEmailTemplate('password-reset', 'html', { APP_NAME, resetLink });
  const text = loadEmailTemplate('password-reset', 'txt', { APP_NAME, resetLink });

  const msg = {
    to,
    from: FROM_EMAIL,
    subject: `Reset your ${APP_NAME} password`,
    text:
      text ||
      `You requested a password reset. Click the link below to set a new password:\n\n${resetLink}\n\nThis link expires in 1 hour.\n\nBest regards,\nThe ${APP_NAME} Team`,
    html:
      html ||
      `<p>You requested a password reset. Click the link below to set a new password:</p><p><a href="${resetLink}">Reset password</a></p><p>This link expires in 1 hour.</p><p>Best regards,<br/>The ${APP_NAME} Team</p>`,
  };

  try {
    await sgMail.send(msg);
  } catch (err: any) {
    console.error('[emailService] sendPasswordResetEmail failed:', err?.response?.body ?? err?.message ?? err);
  }
}

/**
 * Send welcome email to a new customer with their member ID and QR code (fire-and-forget; errors are logged only).
 * Uses email-templates/customer-welcome.html and .txt.
 */
export async function sendCustomerWelcomeEmail(
  to: string,
  name: string,
  memberCode: string,
  restaurantName?: string
): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn('[emailService] SENDGRID_API_KEY not set; skipping customer welcome email');
    return;
  }

  const welcomeLine = restaurantName
    ? `Welcome to ${restaurantName}'s loyalty program.`
    : `Welcome to the ${APP_NAME} loyalty program.`;

  let qrBuffer: Buffer;
  try {
    qrBuffer = await QRCode.toBuffer(memberCode, { type: 'png', margin: 2, width: 200 });
  } catch (err: any) {
    console.error('[emailService] QR code generation failed:', err?.message ?? err);
    return;
  }

  const html = loadEmailTemplate('customer-welcome', 'html', {
    name,
    welcomeLine,
    memberCode,
    APP_NAME,
  });
  const text = loadEmailTemplate('customer-welcome', 'txt', {
    name,
    welcomeLine,
    memberCode,
    APP_NAME,
  });

  const msg = {
    to,
    from: FROM_EMAIL,
    subject: 'Welcome – your member ID',
    text:
      text ||
      `Hi ${name},\n\n${welcomeLine}\n\nYour Member ID: ${memberCode}\n\nBest regards,\nThe ${APP_NAME} Team`,
    html:
      html ||
      `<p>Hi ${name},</p><p>${welcomeLine}</p><p><strong>Your Member ID: ${memberCode}</strong></p><p><img src="cid:memberqrcode" alt="Member QR Code" width="200" height="200" /></p><p>Best regards,<br/>The ${APP_NAME} Team</p>`,
    attachments: [
      {
        content: qrBuffer.toString('base64'),
        filename: 'member-qrcode.png',
        type: 'image/png',
        disposition: 'inline',
        content_id: 'memberqrcode',
      },
    ],
  };

  try {
    await sgMail.send(msg);
  } catch (err: any) {
    console.error('[emailService] sendCustomerWelcomeEmail failed:', err?.response?.body ?? err?.message ?? err);
  }
}

/**
 * Send team member invitation email with temporary password and sign-in instructions (fire-and-forget; errors are logged only).
 * Uses email-templates/team-invite.html and .txt.
 */
export async function sendTeamMemberInviteEmail(
  to: string,
  name: string,
  temporaryPassword: string
): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn('[emailService] SENDGRID_API_KEY not set; skipping team member invite email');
    return;
  }

  const signInUrl = APP_URL ? `${APP_URL}/sign-in` : '';
  const instructions =
    signInUrl !== ''
      ? `1. Go to ${signInUrl} and sign in with this email and the temporary password below.\n2. Change your password after your first login (recommended).`
      : '1. Sign in to the platform with this email and the temporary password below.\n2. Change your password after your first login (recommended).';
  const instructionsHtml =
    signInUrl !== ''
      ? `<ol><li>Go to <a href="${signInUrl}">${signInUrl}</a> and sign in with this email and the temporary password below.</li><li>Change your password after your first login (recommended).</li></ol>`
      : '<ol><li>Sign in to the platform with this email and the temporary password below.</li><li>Change your password after your first login (recommended).</li></ol>';

  const html = loadEmailTemplate('team-invite', 'html', {
    name,
    APP_NAME,
    instructionsHtml,
    temporaryPassword,
  });
  const text = loadEmailTemplate('team-invite', 'txt', {
    name,
    APP_NAME,
    instructions,
    temporaryPassword,
  });

  const msg = {
    to,
    from: FROM_EMAIL,
    subject: `You're invited to ${APP_NAME}`,
    text:
      text ||
      `Hi ${name},\n\nYou've been invited to join ${APP_NAME} as a team member.\n\nInstructions:\n${instructions}\n\nYour temporary password: ${temporaryPassword}\n\nBest regards,\nThe ${APP_NAME} Team`,
    html:
      html ||
      `<p>Hi ${name},</p><p>You've been invited to join <strong>${APP_NAME}</strong> as a team member.</p><p><strong>Your temporary password:</strong> <code>${temporaryPassword}</code></p><p>Best regards,<br/>The ${APP_NAME} Team</p>`,
  };

  try {
    await sgMail.send(msg);
  } catch (err: any) {
    console.error('[emailService] sendTeamMemberInviteEmail failed:', err?.response?.body ?? err?.message ?? err);
  }
}
