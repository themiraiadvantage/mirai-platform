import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import nodemailer from "nodemailer";
import { config } from "../config";
import { verificationEmail, staffInvitationEmail } from "./templates";
import { withBrandLogo } from "./brand";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport = nodemailer.createTransport({
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
  async sendStaffInvitation(
    email: string,
    name: string,
    role: string,
    token: string,
    owner: boolean,
  ) {
    const message = staffInvitationEmail(
      name,
      role.replaceAll("_", " "),
      `${config.FRONTEND_URL}/admin/set-password#token=${token}`,
      owner,
    );
    try {
      await this.transport.sendMail({
        from: config.MAIL_FROM || `MIRAI <${config.SMTP_USER}>`,
        to: email,
        ...withBrandLogo(message),
      });
    } catch {
      this.logger.error("Staff invitation delivery failed");
      throw new ServiceUnavailableException(
        "The invitation could not be delivered. Please try again shortly.",
      );
    }
  }
  async sendVerification(email: string, name: string, token: string, code: string) {
    const message = verificationEmail(
      name,
      code,
      `${config.API_URL}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`,
    );
    try {
      await this.transport.sendMail({
        from: config.MAIL_FROM || `MIRAI <${config.SMTP_USER}>`,
        to: email,
        ...withBrandLogo(message),
      });
    } catch {
      this.logger.error("Verification email delivery failed");
      throw new ServiceUnavailableException(
        "Email delivery is temporarily unavailable. Please request a new verification email shortly.",
      );
    }
  }
}
