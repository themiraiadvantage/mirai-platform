require("dotenv/config");
const nodemailer = require("nodemailer");
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  requireTLS: Number(process.env.SMTP_PORT) !== 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { minVersion: "TLSv1.2" },
  connectionTimeout: 10000,
});
transport
  .verify()
  .then(() => console.log("SMTP connection and authentication verified. No email was sent."))
  .catch(() => {
    console.error("SMTP verification failed. Check network access and SMTP credentials.");
    process.exitCode = 1;
  })
  .finally(() => transport.close());
