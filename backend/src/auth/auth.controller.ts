import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { config } from "../config";
import { escapeHtml, page } from "../mail/templates";
import { AuthGuard, AuthRequest } from "./auth.guard";
import { AuthService } from "./auth.service";
import { StaffService } from "./staff.service";
import { AcceptStaffDto } from "./staff.dto";
import { EmailDto, LoginDto, SignupDto, VerifyEmailDto, VerifyCodeDto } from "./dto";

const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/v1/auth",
};
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly staff: StaffService,
  ) {}
  @Post("admin/invitation")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  invitation(@Body() body: VerifyEmailDto) {
    return this.staff.inspect(body.token);
  }

  @Post("admin/accept-invitation")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  acceptInvitation(@Body() body: AcceptStaffDto) {
    return this.staff.accept(body.token, body.password);
  }
  @Post("signup")
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  signup(@Body() body: SignupDto) {
    return this.auth.signup(body);
  }

  @Post("resend-verification")
  @HttpCode(202)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  resend(@Body() body: EmailDto) {
    return this.auth.resend(body.email);
  }

  @Post("verify-email")
  @HttpCode(200)
  verify(@Body() body: VerifyEmailDto) {
    return this.auth.verifyEmail(body.token);
  }

  @Post("verify-code")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verifyCode(@Body() body: VerifyCodeDto) {
    return this.auth.verifyCode(body.email, body.code);
  }

  @Get("verify-email")
  verificationPage(@Query() query: VerifyEmailDto, @Res() response: Response) {
    response
      .type("html")
      .send(
        page(
          "Make it official.",
          `<p style="line-height:1.8">Confirm your email to activate your MIRAI account.</p><form method="post" action="/api/v1/auth/verify-email/confirm"><input type="hidden" name="token" value="${escapeHtml(query.token)}"><button style="padding:16px 28px;border:0;border-radius:6px;background:#DF9F53;color:#00101A;font-size:16px;font-weight:bold;cursor:pointer">Confirm my email</button></form>`,
        ),
      );
  }

  @Post("verify-email/confirm")
  @HttpCode(200)
  async confirm(@Body() body: VerifyEmailDto, @Res() response: Response) {
    try {
      await this.auth.verifyEmail(body.token);
      response
        .type("html")
        .send(
          page(
            "You are verified.",
            `<p style="line-height:1.8">Your email is confirmed and your MIRAI account is ready. You can now sign in.</p><a href="${escapeHtml(new URL("/sign-in", config.FRONTEND_URL).href)}" style="display:inline-block;margin-top:16px;padding:16px 28px;background:#DF9F53;color:#00101A;border-radius:6px;text-decoration:none;font-weight:bold">Continue to sign in &rarr;</a>`,
          ),
        );
    } catch (error) {
      if (!(error instanceof Error) || !("getStatus" in error)) throw error;
      response
        .status(400)
        .type("html")
        .send(
          page(
            "This link is unavailable.",
            '<p style="line-height:1.8">It may have expired or already been used. Request a new verification email to continue.</p>',
          ),
        );
    }
  }

  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.setSession(await this.auth.login(body), response);
  }

  @Post("admin/login")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async adminLogin(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.setSession(await this.auth.login(body, true), response);
  }

  @Post("refresh")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    // Browser clients must supply a trusted Origin; non-browser clients can send it explicitly.
    if (
      !request.headers.origin ||
      ![new URL(config.FRONTEND_URL).origin, new URL(config.API_URL).origin].includes(
        request.headers.origin,
      )
    )
      throw new ForbiddenException("Untrusted request origin");
    try {
      return this.setSession(await this.auth.refresh(request.cookies?.mirai_refresh), response);
    } catch (error) {
      response.clearCookie("mirai_refresh", cookieOptions);
      throw error;
    }
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: AuthRequest) {
    return { user: request.auth.user };
  }

  @Post("logout")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    response.clearCookie("mirai_refresh", cookieOptions);
    return this.auth.logout(request.auth.sessionId);
  }

  private setSession(result: Awaited<ReturnType<AuthService["login"]>>, response: Response) {
    const { refreshToken, ...body } = result;
    response.cookie("mirai_refresh", refreshToken, { ...cookieOptions, maxAge: 30 * 86400000 });
    return body;
  }
}
