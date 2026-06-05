import nodemailer from 'nodemailer';

// Pull SMTP config from env so the dev server "just works" without it,
// while production can drop in real creds (SES, Postmark, Resend, Gmail, etc).
const HAVE_SMTP =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

let transporterPromise = null;

async function getTransporter() {
  if (transporterPromise) return transporterPromise;

  if (HAVE_SMTP) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    );
    console.log(`[backend] ✉ SMTP configured: ${process.env.SMTP_HOST}`);
  } else {
    // Ethereal — a free fake SMTP, perfect for development. Generates real
    // RFC822 messages with a preview URL printed to the server log.
    transporterPromise = nodemailer
      .createTestAccount()
      .then((acc) => {
        console.log(`[backend] ✉ Dev SMTP via ethereal.email — user=${acc.user}`);
        return nodemailer.createTransport({
          host: acc.smtp.host,
          port: acc.smtp.port,
          secure: acc.smtp.secure,
          auth: { user: acc.user, pass: acc.pass },
        });
      })
      .catch((err) => {
        // Network may be offline (this is a dev fallback). Return null so
        // we degrade to console logging instead of crashing the server.
        console.warn('[backend] ⚠ Could not create dev SMTP, emails will be logged only:', err.message);
        return null;
      });
  }
  return transporterPromise;
}

async function sendMail(message) {
  try {
    const transporter = await getTransporter();
    if (!transporter) {
      console.log(`[EMAIL → ${message.to}] ${message.subject}\n${message.text || message.html}`);
      return;
    }
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"ENTJ Workspace" <no-reply@entj.workspace>',
      ...message,
    });
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log(`[backend] ✉ sent to ${message.to} — preview: ${preview}`);
    else console.log(`[backend] ✉ sent to ${message.to}`);
  } catch (err) {
    console.error(`[backend] ✉ delivery to ${message.to} failed:`, err.message);
  }
}

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

export async function sendInvitationEmail({ to, fromEmail, eventTitle, startIso, meetingLink }) {
  const link = meetingLink || `${APP_URL}/workspace/calendar`;
  const subject = `Meeting invite: ${eventTitle}`;
  const text =
    `${fromEmail} invited you to "${eventTitle}" on ${new Date(startIso).toLocaleString()}.\n\n` +
    `Open: ${link}\n\n— ENTJ Workspace`;
  await sendMail({ to, subject, text });
}

export async function sendTeamInviteEmail({ to, fromEmail }) {
  const subject = `You've been invited to ENTJ Workspace`;
  const text =
    (fromEmail ? `${fromEmail} ` : 'Someone ') +
    `added you to a Shared Calendar workspace at ${APP_URL}.\n\n` +
    `Open it here: ${APP_URL}/workspace\n\n— ENTJ Workspace`;
  await sendMail({ to, subject, text });
}
