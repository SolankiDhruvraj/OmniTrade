import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  // Resend or Brevo or Custom SMTP or Gmail
  if (env.email.smtpHost) {
    transporter = nodemailer.createTransport({
      host: env.email.smtpHost,
      port: env.email.smtpPort,
      secure: env.email.smtpSecure, // true for 465, false for 587 / other ports
      auth: {
        user: env.email.smtpUser,
        pass: env.email.smtpPass,
      },
    });
  } else if (env.email.service || env.email.smtpUser) {
    // Default to Gmail or configured service
    transporter = nodemailer.createTransport({
      service: env.email.service || "gmail",
      auth: {
        user: env.email.smtpUser,
        pass: env.email.smtpPass,
      },
    });
  }

  return transporter;
};

export const sendPasswordResetEmail = async ({ to, resetUrl, expiresAt }) => {
  const mailer = getTransporter();

  if (!mailer || !env.email.smtpUser) {
    console.warn(`[Email Service] SMTP not configured. Password reset link for ${to}: ${resetUrl}`);
    return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  const formattedExpiry = new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const mailOptions = {
    from: env.email.from || `"Workspace Security" <${env.email.smtpUser}>`,
    to,
    subject: "Reset your account password",
    text: `Hello,\n\nYou requested to reset your account password.\n\nPlease use the link below to set a new password:\n${resetUrl}\n\nThis link is single-use and will expire in 15 minutes (${formattedExpiry}).\n\nIf you did not request a password reset, you can safely ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1a202c;">
        <h2 style="color: #488286; margin-top: 0;">Password Reset Request</h2>
        <p>Hello,</p>
        <p>We received a request to reset the password for your account.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background-color: #488286; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 14px; color: #718096;">
          If the button above does not work, copy and paste this link into your browser:
        </p>
        <p style="font-size: 13px; word-break: break-all; color: #4a5568; background-color: #edf2f7; padding: 10px; border-radius: 4px;">
          ${resetUrl}
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #a0aec0; margin-bottom: 0;">
          This link will expire in <strong>15 minutes</strong>. If you did not make this request, your account is safe and you can ignore this email.
        </p>
      </div>
    `,
  };

  const info = await mailer.sendMail(mailOptions);
  return { sent: true, messageId: info.messageId };
};

export const sendInvitationEmail = async ({ to, invitationUrl, expiresAt }) => {
  const mailer = getTransporter();

  // If email credentials are not configured yet, log the invitation link so it's not lost
  if (!mailer || !env.email.smtpUser) {
    console.warn(
      `[Email Service] SMTP not configured. Invitation link for ${to}: ${invitationUrl}`
    );
    return {
      sent: false,
      reason: "SMTP_NOT_CONFIGURED",
    };
  }

  const formattedExpiry = new Date(expiresAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const mailOptions = {
    from: env.email.from || `"Dhruvraj Solanki" <${env.email.smtpUser}>`,
    to,
    subject: "Your invitation link",
    text: `Hi ${to},\n\nHere is your private link to join the console:\n\n${invitationUrl}\n\nPlease set up your password and 2FA. This link will expire in 15 minutes (${formattedExpiry}).\n\nBest regards,\nDhruvraj`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #222222; line-height: 1.6; max-width: 540px;">
        <p>Hi ${to},</p>
        <p>Here is your private link to join the console:</p>
        <p style="margin: 20px 0;">
          <a href="${invitationUrl}" style="background-color: #488286; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: 500; display: inline-block;">
            Set up your account
          </a>
        </p>
        <p style="font-size: 13px; color: #666666;">
          Direct link: <a href="${invitationUrl}" style="color: #488286; word-break: break-all;">${invitationUrl}</a>
        </p>
        <p style="font-size: 13px; color: #888888; margin-top: 24px;">
          Note: This link expires in 15 minutes (${formattedExpiry}).
        </p>
        <p style="margin-top: 24px; color: #444444;">
          Best regards,<br />
          Dhruvraj
        </p>
      </div>
    `,
  };

  const info = await mailer.sendMail(mailOptions);
  return { sent: true, messageId: info.messageId };
};
