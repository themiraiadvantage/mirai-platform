const fs = require("node:fs");
const path = require("node:path");
const { verificationEmail } = require("../dist/mail/templates");
const destination = path.resolve("docs/verification-email-preview.html");
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(
  destination,
  verificationEmail(
    "Alex",
    "123456",
    "https://api.example.com/api/v1/auth/verify-email?token=preview",
  ).html,
);
console.log("Email preview saved to docs/verification-email-preview.html");
