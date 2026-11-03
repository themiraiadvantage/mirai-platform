require("dotenv/config");
const nodemailer = require("nodemailer");
const { page } = require("../dist/mail/templates");
const { withBrandLogo } = require("../dist/mail/brand");
const { config } = require("../dist/config");

const recipient = process.argv[2];
if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
  console.error("Usage: node scripts/send-email-preview.cjs recipient@example.com");
  process.exit(1);
}

const message = {
  subject: "MIRAI | White logo email preview",
  text: "Hello Seun,\n\nHere is the updated MIRAI email design, with the white and gold logo on our navy header.\n\nThis is a design preview only. The sample verification code 123456 cannot verify an account and requires no action.\n\nThe MIRAI Team",
  html: page(
    "Your next step is here.",
    `<p style="margin:0 0 18px;color:#805b2a;font-size:11px;font-weight:bold;letter-spacing:1.6px">EMAIL DESIGN PREVIEW</p>
    <p style="font-size:16px;line-height:1.8">Hello Seun,</p>
    <p style="font-size:15px;line-height:1.8;color:#475761">Here is the updated MIRAI email design. Our white and gold logo now sits directly on the navy header for a cleaner, more consistent look.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0"><tr><td style="padding:22px 12px;background:#fbf4eb;border:1px solid #efdbc2;border-radius:8px;text-align:center"><p style="margin:0 0 12px;color:#805b2a;font-size:11px;letter-spacing:1.5px">SAMPLE VERIFICATION CODE</p><span style="font-family:Consolas,monospace;font-size:36px;font-weight:bold;letter-spacing:8px;color:#00101A">123456</span></td></tr></table>
    <p style="font-size:13px;line-height:1.8;color:#65727a">This is a design preview only. The sample code cannot verify an account, and no action is required.</p>
    <hr style="border:0;border-top:1px solid #e7ebed;margin:26px 0">
    <p style="font-size:14px;line-height:1.8;color:#475761">With clarity at every step,<br><strong style="color:#00101A">The MIRAI Team</strong></p>`,
  ),
};

const transport = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,
  requireTLS: config.SMTP_PORT !== 465,
  auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
  tls: { minVersion: "TLSv1.2" },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

transport
  .sendMail({
    from: config.MAIL_FROM || `MIRAI <${config.SMTP_USER}>`,
    to: recipient,
    ...withBrandLogo(message),
  })
  .then((result) => {
    if (
      !result.accepted?.some((address) => String(address).toLowerCase() === recipient.toLowerCase())
    )
      throw new Error("Recipient not accepted");
    console.log(JSON.stringify({ accepted: result.accepted, messageId: result.messageId }));
  })
  .catch((error) => {
    console.error("Preview delivery failed:", error.code || error.message);
    process.exitCode = 1;
  })
  .finally(() => transport.close());
