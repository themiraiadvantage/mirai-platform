import { brandLogoDataUrl } from "./brand";

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );

export function page(title: string, content: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | MIRAI</title></head><body style="margin:0;background:#f3f4f5;color:#00101A;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:40px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden"><tr><td align="center" bgcolor="#00101A" style="padding:30px 28px 26px;background:#00101A;border-bottom:2px solid #DF9F53;text-align:center"><img src="${brandLogoDataUrl}" width="200" height="100" alt="MIRAI" style="display:block;width:200px;max-width:100%;height:auto;margin:0 auto;border:0;color:#ffffff;font-size:22px"><p style="color:#c4ced5;font-size:11px;line-height:1.8;margin:18px 0 0;letter-spacing:2px">YOUR NEXT CHAPTER STARTS HERE</p></td></tr><tr><td style="padding:36px 32px"><h1 style="font-size:28px;line-height:1.2;margin:0 0 24px">${escapeHtml(title)}</h1>${content}</td></tr><tr><td style="padding:24px 32px;background:#f8f9fa;color:#65727a;font-size:12px;line-height:1.7">MIRAI &bull; Land. Confidence. Possibility.<br>This is an account notification. Keep your verification code private.</td></tr></table><p style="text-align:center;font-size:12px;color:#65727a">&copy; ${new Date().getFullYear()} MIRAI. All rights reserved.</p></td></tr></table></body></html>`;
}

export function staffInvitationEmail(name: string, role: string, url: string, owner: boolean) {
  const title = owner ? "Set up your MIRAI owner account" : "You have been invited to MIRAI Admin";
  const description = `Your access role is ${role}. Choose your own password to activate your account. This link expires in 24 hours and can only be used once.`;
  return {
    subject: title,
    text: `Hi ${name},\n\n${description}\n\nSet your password: ${url}\n\nKeep this link private. If you did not expect this invitation, ignore it.`,
    html: page(
      title,
      `<p>Hi ${escapeHtml(name)},</p><p style="line-height:1.8">${escapeHtml(description)}</p><a href="${escapeHtml(url)}" style="display:inline-block;padding:16px 24px;background:#DF9F53;color:#00101A;border-radius:6px;text-decoration:none;font-weight:bold">Set my password</a><p style="font-size:12px;line-height:1.8;margin-top:28px">Keep this link private. If you did not expect this invitation, ignore it.</p>`,
    ),
  };
}

export function verificationEmail(name: string, code: string, url?: string) {
  const safeCode = escapeHtml(code);
  const fallback = url
    ? `<p style="font-size:12px;line-height:1.8;color:#65727a">You can also <a href="${escapeHtml(url)}" style="color:#475761">confirm your email using this link</a>.</p>`
    : "";
  return {
    subject: "Your MIRAI email verification code",
    text: `Hi ${name},\n\nYour MIRAI verification code is: ${code}\n\nEnter this 6-digit code on the verification screen to activate your account. It expires in 10 minutes and can only be used once. Never share your code. If you did not create an account, ignore this email.${url ? `\n\nAlternatively, confirm your email here: ${url}` : ""}`,
    html: page(
      "Your next step is here.",
      `<p style="line-height:1.8">Hi ${escapeHtml(name)},</p><p style="line-height:1.8;color:#475761">Welcome to MIRAI. Enter this code on the verification screen to confirm your email and finish setting up your account.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0"><tr><td style="padding:24px 12px;background:#fbf4eb;border:1px solid #efdbc2;border-radius:8px;text-align:center"><span style="font-family:Consolas,monospace;font-size:36px;font-weight:bold;letter-spacing:8px;color:#00101A">${safeCode}</span></td></tr></table><p style="font-size:13px;line-height:1.8;color:#65727a">Your code expires in <strong>10 minutes</strong> and can only be used once. Keep this email open while you enter the code.</p><hr style="border:0;border-top:1px solid #e7ebed;margin:28px 0">${fallback}<p style="font-size:12px;line-height:1.8;color:#65727a">Never share your code. Did not create an account? You can safely ignore this email.</p>`,
    ),
  };
}
