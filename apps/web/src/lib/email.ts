import tls from 'tls';
import { prisma } from '@clinic/db';
import { reportServerError } from '@/lib/observability';

export interface SendStaffEmailParams {
  email: string;
  name: string;
  role: string;
  temporaryPassword: string;
  room?: string;
  specialty?: string;
  existingDeliveryId?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  emailSent: boolean;
  recipient: string;
  subject: string;
  dispatchedAt: string;
  messageId: string;
  provider: 'SMTP' | 'RESEND' | 'INTERNAL_SIMULATION';
  error?: string;
  setupInstructions?: string;
}

function extractEmail(str: string): string {
  const match = str.match(/<([^>]+)>/);
  return match ? match[1].trim() : str.trim();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] || character));
}

function getRuntimeSmtpConfig() {
  return {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    from: process.env.EMAIL_FROM,
  };
}

/**
 * Native Zero-Dependency TLS SMTP Client for Node.js
 * Supports direct connection to smtp.gmail.com:465 or custom SSL SMTP servers.
 */
function sendViaNativeSmtp(options: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return new Promise((resolve) => {
    let client: tls.TLSSocket | null = null;
    let isDone = false;

    const timeout = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        try {
          client?.destroy();
        } catch (_) {}
        resolve({ success: false, error: 'SMTP connection timed out after 12s.' });
      }
    }, 12000);

    try {
      const cleanEnvelopeFrom = extractEmail(options.from);
      const cleanEnvelopeTo = extractEmail(options.to);
      const fromHeader = options.from.includes('<')
        ? options.from
        : `"Laguna Medical Center" <${cleanEnvelopeFrom}>`;
      const toHeader = `<${cleanEnvelopeTo}>`;

      client = tls.connect(options.port, options.host, { rejectUnauthorized: true }, () => {
        // Connected to TLS SMTP server
      });

      let step = 0;
      const b64User = Buffer.from(options.user).toString('base64');
      const b64Pass = Buffer.from(options.pass.replace(/\s+/g, '')).toString('base64');

      client.setEncoding('utf8');
      client.on('data', (data: string) => {
        if (isDone) return;
        const line = data.toString();
        const code = parseInt(line.substring(0, 3), 10);

        if (code >= 400) {
          isDone = true;
          clearTimeout(timeout);
          try {
            client?.write('QUIT\r\n');
            client?.end();
          } catch (_) {}
          return resolve({ success: false, error: `SMTP Server Error (${code}): ${line.trim()}` });
        }

        if (step === 0 && code === 220) {
          step++;
          client?.write(`EHLO ${options.host}\r\n`);
        } else if (step === 1 && code === 250) {
          step++;
          client?.write('AUTH LOGIN\r\n');
        } else if (step === 2 && code === 334) {
          step++;
          client?.write(`${b64User}\r\n`);
        } else if (step === 3 && code === 334) {
          step++;
          client?.write(`${b64Pass}\r\n`);
        } else if (step === 4 && (code === 235 || code === 250)) {
          step++;
          client?.write(`MAIL FROM:<${cleanEnvelopeFrom}>\r\n`);
        } else if (step === 5 && code === 250) {
          step++;
          client?.write(`RCPT TO:<${cleanEnvelopeTo}>\r\n`);
        } else if (step === 6 && code === 250) {
          step++;
          client?.write('DATA\r\n');
        } else if (step === 7 && code === 354) {
          step++;
          const messageId = `<lmc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@${options.host}>`;
          const rawMessage = [
            `From: ${fromHeader}`,
            `To: ${toHeader}`,
            `Subject: ${options.subject}`,
            `Message-ID: ${messageId}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: 7bit',
            '',
            options.html,
            '',
            '.'
          ].join('\r\n');

          client?.write(`${rawMessage}\r\n`);
        } else if (step === 8 && code === 250) {
          isDone = true;
          clearTimeout(timeout);
          try {
            client?.write('QUIT\r\n');
            client?.end();
          } catch (_) {}
          return resolve({ success: true, messageId: `smtp-${Date.now()}` });
        }
      });

      client.on('error', (err) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeout);
          resolve({ success: false, error: err.message });
        }
      });
    } catch (err: any) {
      if (!isDone) {
        isDone = true;
        clearTimeout(timeout);
        resolve({ success: false, error: err?.message || String(err) });
      }
    }
  });
}

async function dispatchStaffWelcomeEmail(params: SendStaffEmailParams): Promise<EmailDispatchResult> {
  const { email, name, role, temporaryPassword, room, specialty } = params;
  const dispatchedAt = new Date().toISOString();
  const messageId = `lmc-msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const subject = 'Laguna Medical Center — Staff Access & Security Credentials';

  const loginUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeRole = escapeHtml(role);
  const safeRoom = room ? escapeHtml(room) : undefined;
  const safeSpecialty = specialty ? escapeHtml(specialty) : undefined;
  const safeTemporaryPassword = escapeHtml(temporaryPassword);
  const safeLoginUrl = escapeHtml(loginUrl);

  const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Hospital Header Banner -->
          <tr>
            <td style="background-color: #0f172a; padding: 26px 32px; border-bottom: 3px solid #0284c7;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <!-- Medical Cross Emblem -->
                        <td style="background-color: #0284c7; width: 32px; height: 32px; border-radius: 6px; text-align: center; vertical-align: middle;">
                          <span style="color: #ffffff; font-size: 20px; font-weight: 700; line-height: 32px; display: block;">+</span>
                        </td>
                        <td style="padding-left: 12px;">
                          <span style="font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            Laguna Medical Center
                          </span>
                          <span style="font-size: 11px; font-weight: 500; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-top: 2px;">
                            Hospital Information System &bull; Secure Dispatch
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Content Body -->
          <tr>
            <td style="padding: 32px; background-color: #ffffff;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #0f172a; line-height: 1.5;">
                Hello <strong>${safeName}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                An institutional staff access account has been provisioned for you in the <strong>Laguna Medical Center EHR &amp; Clinical Management System</strong>. Below are your operational credentials:
              </p>

              <!-- Credentials Card Table (100% Gmail-compatible Table layout) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td colspan="2" style="background-color: #f1f5f9; padding: 10px 18px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.06em;">
                      Operational Credentials Summary
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; width: 38%; font-size: 12px; font-weight: 600; color: #64748b;">
                    Full Name
                  </td>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; font-weight: 600; color: #0f172a;">
                    ${safeName}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 12px; font-weight: 600; color: #64748b;">
                    Assigned Role
                  </td>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7;">
                    <span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; border: 1px solid #bae6fd;">
                      ${safeRole}
                    </span>
                  </td>
                </tr>
                ${safeSpecialty ? `
                <tr>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 12px; font-weight: 600; color: #64748b;">
                    Specialization
                  </td>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; font-weight: 600; color: #0f172a;">
                    ${safeSpecialty}
                  </td>
                </tr>` : ''}
                ${safeRoom ? `
                <tr>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 12px; font-weight: 600; color: #64748b;">
                    Assigned Station / Room
                  </td>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; font-weight: 600; color: #0f172a;">
                    ${safeRoom}
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 12px; font-weight: 600; color: #64748b;">
                    Portal Username / Email
                  </td>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; font-weight: 600; color: #0284c7; font-family: 'SFMono-Regular', Consolas, Menlo, monospace;">
                    ${safeEmail}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px; font-size: 12px; font-weight: 600; color: #64748b;">
                    Temporary Password
                  </td>
                  <td style="padding: 14px 18px;">
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background-color: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 5px; padding: 6px 14px;">
                          <span style="font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; font-size: 14px; font-weight: 700; color: #0f172a; letter-spacing: 0.5px;">
                            ${safeTemporaryPassword}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Notice Banner -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size: 12px; line-height: 1.5; color: #92400e;">
                          <strong>Security Notice:</strong> Please sign in to your workstation workspace and change this temporary password immediately upon your first authentication.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Button (Bulletproof HTML email button with high contrast) -->
              <table border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 12px 0;">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #0f172a;">
                    <a href="${safeLoginUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600; color: #ffffff !important; text-decoration: none !important; padding: 13px 30px; border-radius: 6px; display: inline-block; border: 1px solid #0f172a;">
                      Log In to Clinic Portal
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 16px 0 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Direct URL: <a href="${safeLoginUrl}" style="color: #0284c7; text-decoration: underline;">${safeLoginUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer Notice -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: #475569;">
                Laguna Medical Center &bull; IT Systems &amp; Clinic Administration
              </p>
              <p style="margin: 0; color: #94a3b8;">
                Confidentiality Notice: This institutional email and credentials are meant solely for the designated recipient. If received erroneously, immediately inform clinic IT administration.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // 1. Check if SMTP configuration exists (e.g. Gmail App Password, Custom SMTP)
  const runtimeConfig = getRuntimeSmtpConfig();
  const smtpUser = runtimeConfig.user;
  const smtpPass = runtimeConfig.pass;

  if (smtpUser && smtpPass) {
    const smtpHost = runtimeConfig.host || 'smtp.gmail.com';
    const smtpPort = runtimeConfig.port || 465;
    // For Gmail SMTP, envelope must be the authenticated user
    const fromAddress = smtpHost.includes('gmail.com')
      ? `"Laguna Medical Center" <${smtpUser}>`
      : (runtimeConfig.from || smtpUser);

    console.log('[EMAIL_DISPATCH] Attempting SMTP transmission.');

    const smtpRes = await sendViaNativeSmtp({
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      pass: smtpPass,
      from: fromAddress,
      to: email,
      subject,
      html: htmlContent,
    });

    if (smtpRes.success) {
      console.log(`[EMAIL_DISPATCH] Successfully sent email to ${email} via SMTP.`);
      return {
        success: true,
        emailSent: true,
        recipient: email,
        subject,
        dispatchedAt,
        messageId: smtpRes.messageId || messageId,
        provider: 'SMTP',
      };
    } else {
      console.error(`[EMAIL_DISPATCH] SMTP transmission failed:`, smtpRes.error);
      await reportServerError(new Error(smtpRes.error || 'SMTP transmission failed.'), { component: 'email', provider: 'SMTP', template: 'STAFF_WELCOME' });
      return {
        success: true,
        emailSent: false,
        recipient: email,
        subject,
        dispatchedAt,
        messageId,
        provider: 'SMTP',
        error: smtpRes.error,
        setupInstructions: `SMTP transmission failed: ${smtpRes.error}. Please check your SMTP_USER and SMTP_PASS.`,
      };
    }
  }

  // 2. Check if Resend API key is present
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Laguna Medical Center <onboarding@resend.dev>',
          to: [email],
          subject,
          html: htmlContent,
        }),
      });

      if (res.ok) {
        console.log(`[EMAIL_DISPATCH] Successfully sent welcome email to ${email} via Resend.`);
        return {
          success: true,
          emailSent: true,
          recipient: email,
          subject,
          dispatchedAt,
          messageId,
          provider: 'RESEND',
        };
      } else {
        const errorData = await res.json();
        console.error('[EMAIL_DISPATCH] Resend API error:', errorData);
        await reportServerError(new Error('Resend rejected the staff welcome email.'), { component: 'email', provider: 'RESEND', template: 'STAFF_WELCOME', httpStatus: res.status });
      }
    } catch (err: any) {
      console.error('[EMAIL_DISPATCH] Resend API dispatch failed:', err?.message);
      await reportServerError(err, { component: 'email', provider: 'RESEND', template: 'STAFF_WELCOME' });
    }
  }

  // 3. Fallback: Internal Logger & Simulation
  console.log('============================================================');
  console.log('[EMAIL DISPATCH - LOCAL SIMULATION]');
  console.log(`To: ${email}`);
  console.log(`Subject: ${subject}`);
  console.log('Notice: Email delivery is not configured; no credential was logged.');
  console.log('============================================================');

  return {
    success: true,
    emailSent: false,
    recipient: email,
    subject,
    dispatchedAt,
    messageId,
    provider: 'INTERNAL_SIMULATION',
    setupInstructions: 'Walang naka-configure na SMTP_USER at SMTP_PASS sa .env. I-set up ang Gmail App Password upang matanggap ito sa totoong inbox.',
  };
}

export async function sendStaffWelcomeEmail(params: SendStaffEmailParams): Promise<EmailDispatchResult> {
  const subject = 'Laguna Medical Center - Staff Access & Security Credentials';
  const deliveryId = params.existingDeliveryId || `email_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  if (params.existingDeliveryId) {
    await prisma.$executeRaw`UPDATE "email_deliveries" SET "status" = 'PENDING'::"EmailDeliveryStatus", "lastError" = NULL, "nextAttemptAt" = NULL, "updatedAt" = NOW() WHERE "id" = ${deliveryId}`;
  } else {
    await prisma.$executeRaw`INSERT INTO "email_deliveries" ("id", "recipient", "subject", "template", "status", "payload", "createdAt", "updatedAt") VALUES (${deliveryId}, ${params.email}, ${subject}, 'STAFF_WELCOME', 'PENDING'::"EmailDeliveryStatus", ${JSON.stringify({ name: params.name, role: params.role, room: params.room || null, specialty: params.specialty || null })}::jsonb, NOW(), NOW())`;
  }
  const result = await dispatchStaffWelcomeEmail(params);
  const status = result.emailSent ? 'SENT' : result.provider === 'INTERNAL_SIMULATION' ? 'SIMULATED' : 'FAILED';
  await prisma.$executeRawUnsafe(
    `UPDATE "email_deliveries" SET "status" = $1::"EmailDeliveryStatus", "provider" = $2, "messageId" = $3, "attempts" = "attempts" + 1, "lastAttemptAt" = NOW(), "sentAt" = $4, "lastError" = $5, "nextAttemptAt" = $6, "updatedAt" = NOW() WHERE "id" = $7`,
    status, result.provider, result.messageId, result.emailSent ? new Date() : null, result.error || result.setupInstructions || null, status === 'FAILED' ? new Date(Date.now() + 15 * 60 * 1000) : null, deliveryId,
  );
  return result;
}

export async function sendPatientAccountEmail(params: {
  email: string;
  name: string;
  purpose: 'ACTIVATION' | 'PASSWORD_RESET';
  token: string;
}): Promise<EmailDispatchResult> {
  const isActivation = params.purpose === 'ACTIVATION';
  const subject = isActivation ? 'Activate your Laguna Medical Center patient account' : 'Reset your Laguna Medical Center password';
  const actionUrl = `${process.env.MOBILE_ACCOUNT_URL || 'lagunamedical://account'}?mode=${isActivation ? 'activate' : 'reset'}&token=${encodeURIComponent(params.token)}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>${escapeHtml(subject)}</h2><p>Hello ${escapeHtml(params.name)},</p><p>${isActivation ? 'Finish activating your patient account' : 'Complete your requested password reset'} using the secure link below. It expires in 30 minutes and can only be used once.</p><p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:white;text-decoration:none;border-radius:6px">${isActivation ? 'Activate account' : 'Reset password'}</a></p><p>If you did not request this, ignore this message or contact the clinic.</p></div>`;
  const dispatchedAt = new Date().toISOString();
  const deliveryId = `email_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await prisma.$executeRaw`INSERT INTO "email_deliveries" ("id", "recipient", "subject", "template", "status", "payload", "createdAt", "updatedAt") VALUES (${deliveryId}, ${params.email}, ${subject}, ${`PATIENT_${params.purpose}`}, 'PENDING'::"EmailDeliveryStatus", ${JSON.stringify({ name: params.name, purpose: params.purpose })}::jsonb, NOW(), NOW())`;

  let dispatch: EmailDispatchResult = { success: true, emailSent: false, recipient: params.email, subject, dispatchedAt, messageId: `patient-${Date.now()}`, provider: 'INTERNAL_SIMULATION', setupInstructions: 'Email delivery is not configured.' };
  const smtp = getRuntimeSmtpConfig();
  if (smtp.user && smtp.pass && smtp.from) {
    const result = await sendViaNativeSmtp({ host: smtp.host, port: smtp.port, user: smtp.user, pass: smtp.pass, from: smtp.from, to: params.email, subject, html });
    dispatch = { ...dispatch, emailSent: result.success, provider: 'SMTP', messageId: result.messageId || dispatch.messageId, error: result.error };
  } else if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Laguna Medical Center <onboarding@resend.dev>', to: [params.email], subject, html }) });
      const body = await response.json().catch(() => ({}));
      dispatch = { ...dispatch, emailSent: response.ok, provider: 'RESEND', messageId: body.id || dispatch.messageId, error: response.ok ? undefined : 'Email provider rejected the request.' };
    } catch (error) {
      dispatch = { ...dispatch, provider: 'RESEND', error: error instanceof Error ? error.message : 'Email delivery failed.' };
    }
  }
  const status = dispatch.emailSent ? 'SENT' : dispatch.provider === 'INTERNAL_SIMULATION' ? 'SIMULATED' : 'FAILED';
  if (status === 'FAILED') await reportServerError(new Error(dispatch.error || 'Patient account email delivery failed.'), { component: 'email', provider: dispatch.provider, template: `PATIENT_${params.purpose}` });
  await prisma.$executeRawUnsafe(`UPDATE "email_deliveries" SET "status" = $1::"EmailDeliveryStatus", "provider" = $2, "messageId" = $3, "attempts" = 1, "lastAttemptAt" = NOW(), "sentAt" = $4, "lastError" = $5, "nextAttemptAt" = $6, "updatedAt" = NOW() WHERE "id" = $7`, status, dispatch.provider, dispatch.messageId, dispatch.emailSent ? new Date() : null, dispatch.error || dispatch.setupInstructions || null, status === 'FAILED' ? new Date(Date.now() + 15 * 60 * 1000) : null, deliveryId);
  return dispatch;
}
