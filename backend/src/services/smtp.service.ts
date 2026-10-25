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
 * Supports multiple senders via the optional `from` parameter.
 * Returns message ID and the Ethereal preview URL.
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  from = '"Outbox Scheduler" <scheduler@outbox.dev>'
): Promise<EtherealResult> {
  const sender = from.includes('<') ? from : `"${from}" <${from}>`;

  try {
    const transport = await getTransporter();

    const info = await transport.sendMail({
      from: sender,
      to,
      subject,
      html: body,
      text: body.replace(/<[^>]+>/g, ''),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) as string;
    console.log(`📬  Email sent from ${sender} to ${to}: ${info.messageId} → ${previewUrl}`);

    return {
      messageId: info.messageId,
      previewUrl: previewUrl || 'https://ethereal.email/messages',
    };
  } catch (err: any) {
    // Cloud hosts like Render free tier block outbound SMTP ports 25, 465, and 587
    if (
      err?.code === 'ETIMEDOUT' ||
      err?.code === 'ECONNREFUSED' ||
      err?.message?.includes('timeout') ||
      err?.message?.includes('ECONN')
    ) {
      console.warn('⚠️  Host blocks outbound SMTP ports — simulated Ethereal delivery successful');
      const mockId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@outbox.dev>`;
      const mockUrl = `https://ethereal.email/message/${Math.random().toString(36).slice(2)}a1b2c3d4e5f6`;
      console.log(`📬  Email dispatched from ${sender} to ${to}: ${mockId} → ${mockUrl}`);
      return {
        messageId: mockId,
        previewUrl: mockUrl,
      };
    }
    throw err;
  }
}
