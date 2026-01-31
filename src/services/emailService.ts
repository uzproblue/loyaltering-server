import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@example.com';
const APP_NAME = process.env.APP_NAME || 'Loyaltering';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

/**
 * Send welcome email after registration (fire-and-forget; errors are logged only).
 */
export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn('[emailService] SENDGRID_API_KEY not set; skipping welcome email');
    return;
  }

  const msg = {
    to,
    from: FROM_EMAIL,
    subject: `Welcome to ${APP_NAME}`,
    text: `Hi ${name},\n\nWelcome to ${APP_NAME}. Your account has been created successfully.\n\nBest regards,\nThe ${APP_NAME} Team`,
    html: `
      <p>Hi ${name},</p>
      <p>Welcome to ${APP_NAME}. Your account has been created successfully.</p>
      <p>Best regards,<br>The ${APP_NAME} Team</p>
    `,
  };

  try {
    await sgMail.send(msg);
  } catch (err: any) {
    console.error('[emailService] sendWelcomeEmail failed:', err?.response?.body ?? err?.message ?? err);
  }
}

/**
 * Send password reset email with link (fire-and-forget; errors are logged only).
 */
export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn('[emailService] SENDGRID_API_KEY not set; skipping password reset email');
    return;
  }

  const msg = {
    to,
    from: FROM_EMAIL,
    subject: `Reset your ${APP_NAME} password`,
    text: `You requested a password reset. Click the link below to set a new password:\n\n${resetLink}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.\n\nBest regards,\nThe ${APP_NAME} Team`,
    html: `
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <p><a href="${resetLink}">Reset password</a></p>
      <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      <p>Best regards,<br>The ${APP_NAME} Team</p>
    `,
  };

  try {
    await sgMail.send(msg);
  } catch (err: any) {
    console.error('[emailService] sendPasswordResetEmail failed:', err?.response?.body ?? err?.message ?? err);
  }
}
