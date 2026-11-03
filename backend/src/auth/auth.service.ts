import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import * as argon2 from "argon2";
import { PrismaService } from "../database/prisma.service";
import { MailService } from "../mail/mail.service";
import { LoginDto, SignupDto } from "./dto";
import { config } from "../config";
import { recordActivity } from "../activity/record-activity";

export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const freshToken = () => randomBytes(32).toString("hex");
const verificationCodeHash = (userId: string, nonce: string, code: string) =>
  createHmac("sha256", config.JWT_SECRET)
    .update(`email-verification:${userId}:${nonce}:${code}`)
    .digest("hex");
const passwordOptions = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 };
export const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  emailVerifiedAt: true,
  createdAt: true,
  staffRole: true,
  staffActive: true,
  staffPermissions: true,
} as const;
const accepted = {
  message: "If this address needs verification, an email has been sent. Please check your inbox.",
};

@Injectable()
export class AuthService {
  private readonly dummyHash = argon2.hash(randomBytes(32), passwordOptions);
  constructor(
    private readonly db: PrismaService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
  ) {}

  async signup(input: SignupDto) {
    const existing = await this.db.user.findUnique({ where: { email: input.email } });
    if (existing) return this.resend(input.email);
    const passwordHash = await argon2.hash(input.password, passwordOptions);
    try {
      const user = await this.db.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });
      await this.issueVerification(user.id, user.email, user.name);
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      return this.resend(input.email);
    }
    return accepted;
  }

  async resend(email: string) {
    const user = await this.db.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) await this.issueVerification(user.id, user.email, user.name);
    return accepted;
  }

  private async issueVerification(userId: string, email: string, name: string) {
    const token = freshToken();
    const code = randomInt(0, 1000000).toString().padStart(6, "0");
    const codeHash = verificationCodeHash(userId, tokenHash(token), code);
    // A persisted cooldown also prevents concurrent requests from sending many emails.
    const issued = await this.db.$transaction(async (tx) => {
      // Updating the user takes a row lock and follows the configured Prisma schema.
      const user = await tx.user.update({
        where: { id: userId },
        data: { updatedAt: new Date() },
        select: { emailVerifiedAt: true },
      });
      if (user.emailVerifiedAt) return false;
      const previous = await tx.emailVerification.findUnique({ where: { userId } });
      if (previous && previous.createdAt.getTime() > Date.now() - 60000) return false;
      await tx.emailVerification.upsert({
        where: { userId },
        create: {
          userId,
          tokenHash: tokenHash(token),
          codeHash,
          attempts: 0,
          expiresAt: new Date(Date.now() + 10 * 60000),
        },
        update: {
          tokenHash: tokenHash(token),
          codeHash,
          attempts: 0,
          expiresAt: new Date(Date.now() + 10 * 60000),
          createdAt: new Date(),
          sentAt: null,
        },
      });
      return true;
    });
    if (!issued) return;
    try {
      await this.mail.sendVerification(email, name, token, code);
    } catch (error) {
      await this.db.emailVerification.updateMany({
        where: { userId, tokenHash: tokenHash(token) },
        data: { createdAt: new Date(0) },
      });
      throw error;
    }
    await this.db.emailVerification.updateMany({
      where: { userId, tokenHash: tokenHash(token) },
      data: { sentAt: new Date() },
    });
  }

  async verifyCode(email: string, code: string) {
    const user = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    const invalid = "The code is incorrect or has expired. Please check it or request a new code.";
    if (!user) throw new BadRequestException(invalid);
    const failure = await this.db.$transaction(async (tx) => {
      const account = await tx.user.update({
        where: { id: user.id },
        data: { updatedAt: new Date() },
        select: { emailVerifiedAt: true },
      });
      if (account.emailVerifiedAt) return invalid;
      const verification = await tx.emailVerification.findUnique({ where: { userId: user.id } });
      if (!verification?.codeHash || verification.expiresAt.getTime() <= Date.now()) return invalid;
      if (verification.attempts >= 5)
        return "Too many incorrect attempts. Request a new verification code.";
      const expected = verificationCodeHash(user.id, verification.tokenHash, code);
      if (
        !timingSafeEqual(Buffer.from(verification.codeHash, "hex"), Buffer.from(expected, "hex"))
      ) {
        await tx.emailVerification.update({
          where: { id: verification.id },
          data: { attempts: { increment: 1 } },
        });
        return verification.attempts + 1 >= 5
          ? "Too many incorrect attempts. Request a new verification code."
          : invalid;
      }
      const consumed = await tx.emailVerification.deleteMany({
        where: { id: verification.id, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1) return invalid;
      await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
      return null;
    });
    // Throw after the transaction commits so failed attempts cannot be rolled back.
    if (failure) throw new BadRequestException(failure);
    return { message: "Email verified. You can now sign in." };
  }

  async verifyEmail(token: string) {
    await this.db.$transaction(async (tx) => {
      const verification = await tx.emailVerification.findUnique({
        where: { tokenHash: tokenHash(token) },
      });
      if (!verification || verification.expiresAt.getTime() <= Date.now())
        throw new BadRequestException(
          "This verification link is invalid or has expired. Request a new email.",
        );
      const deleted = await tx.emailVerification.deleteMany({
        where: { id: verification.id, tokenHash: tokenHash(token), expiresAt: { gt: new Date() } },
      });
      if (deleted.count !== 1)
        throw new BadRequestException("This verification link has already been used.");
      await tx.user.update({
        where: { id: verification.userId },
        data: { emailVerifiedAt: new Date() },
      });
    });
    return { message: "Email verified. You can now sign in." };
  }

  async login(input: LoginDto, staffOnly = false) {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    const valid = await argon2.verify(user?.passwordHash || (await this.dummyHash), input.password);
    if (!user || !valid) throw new UnauthorizedException("Invalid email or password");
    if (!user.emailVerifiedAt)
      throw new ForbiddenException("Please verify your email before signing in.");
    if (staffOnly && (!user.staffRole || !user.staffActive))
      throw new ForbiddenException("This account does not have active admin access.");
    const refreshToken = freshToken();
    const session = await this.db.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          userId: user.id,
          familyId: randomUUID(),
          refreshTokenHash: tokenHash(refreshToken),
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
      });
      if (user.staffRole)
        await recordActivity(tx, user, {
          category: "AUTH",
          action: "Admin signed in",
          targetId: user.id,
          targetLabel: user.name,
          detail: staffOnly
            ? "Signed in through the admin portal."
            : "Staff account signed in through the buyer portal.",
        });
      return created;
    });
    return { ...(await this.credentials(user.id, session.id)), refreshToken };
  }

  async refresh(token: string | undefined) {
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException("Please sign in again.");
    const newToken = freshToken();
    const result = await this.db.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { refreshTokenHash: tokenHash(token) },
      });
      if (!session) return null;
      if (session.revokedAt) {
        await tx.session.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return null;
      }
      if (session.expiresAt.getTime() <= Date.now()) return null;
      const claimed = await tx.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!claimed.count) {
        await tx.session.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return null;
      }
      return tx.session.create({
        data: {
          userId: session.userId,
          familyId: session.familyId,
          refreshTokenHash: tokenHash(newToken),
          expiresAt: session.expiresAt,
        },
      });
    });
    if (!result)
      throw new UnauthorizedException("Session expired or reused. Please sign in again.");
    return { ...(await this.credentials(result.userId, result.id)), refreshToken: newToken };
  }

  private async credentials(userId: string, sessionId: string) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: safeUserSelect,
    });
    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId },
      {
        secret: config.JWT_SECRET,
        algorithm: "HS256",
        expiresIn: "15m",
        issuer: config.API_URL,
        audience: "mirai-web",
      },
    );
    return { accessToken, tokenType: "Bearer", expiresIn: 900, user };
  }
  async logout(sessionId: string) {
    await this.db.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { user: { select: { id: true, name: true, staffRole: true } } },
      });
      const revoked = await tx.session.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count && session?.user.staffRole)
        await recordActivity(tx, session.user, {
          category: "AUTH",
          action: "Admin signed out",
          targetId: session.user.id,
          targetLabel: session.user.name,
          detail: "Signed out and revoked the current session.",
        });
    });
    return { message: "Signed out successfully." };
  }
}
