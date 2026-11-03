import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { PrismaService } from "../database/prisma.service";
import { config } from "../config";
import { safeUserSelect } from "./auth.service";
import type { StaffRole } from "../generated/prisma/enums";

export type AuthRequest = Request & {
  auth: {
    sessionId: string;
    user: {
      id: string;
      email: string;
      name: string;
      emailVerifiedAt: Date | null;
      createdAt: Date;
      staffRole: StaffRole | null;
      staffActive: boolean;
      staffPermissions: string[];
    };
  };
};
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) throw new UnauthorizedException();
    let payload: { sub: string; sid: string };
    try {
      payload = await this.jwt.verifyAsync(authorization.slice(7), {
        secret: config.JWT_SECRET,
        algorithms: ["HS256"],
        issuer: config.API_URL,
        audience: "mirai-web",
      });
      if (typeof payload.sub !== "string" || typeof payload.sid !== "string") throw new Error();
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
    const session = await this.db.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: { select: safeUserSelect } },
    });
    if (!session || !session.user.emailVerifiedAt)
      throw new UnauthorizedException("Session no longer active");
    request.auth = { sessionId: session.id, user: session.user };
    return true;
  }
}
