import nodemailer from 'nodemailer';

interface EtherealResult {
  messageId: string;
  previewUrl: string;
}

let transporter: nodemailer.Transporter | null = null;

/**
 * Creates an Ethereal test account on first use and caches the transporter.
 * Ethereal is a fake SMTP service — emails are captured but never delivered.
 */
async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  const account = await nodemailer.createTestAccount();
  console.log('📧  Ethereal SMTP account created:');
  console.log(`    User: ${account.user}`);
  console.log(`    Pass: ${account.pass}`);
  console.log(`    SMTP: ${account.smtp.host}:${account.smtp.port}`);

  transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: {
      user: account.user,
      pass: account.pass,
    },
  });

  return transporter;
}

/**
 * Sends an email via Ethereal fake SMTP.
 * Returns message ID and the Ethereal preview URL.
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<EtherealResult> {
  const transport = await getTransporter();

  const info = await transport.sendMail({
    from: '"Outbox Scheduler" <scheduler@outbox.dev>',
    to,
    subject,
    html: body,
    text: body.replace(/<[^>]+>/g, ''),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) as string;
  console.log(`📬  Email sent: ${info.messageId} → ${previewUrl}`);

  return {
    messageId: info.messageId,
    previewUrl,
  };
}
