import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { AuthGuard, AuthRequest } from "../auth/auth.guard";
import { StaffGuard } from "../auth/staff.guard";
import { resolveStaffPermissions } from "../auth/staff-permissions";
import { PrismaService } from "../database/prisma.service";

export class ActivityQuery {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  q?: string;
  @IsOptional()
  @IsIn([
    "AUTH",
    "STAFF",
    "SETTINGS",
    "ANNOUNCEMENTS",
    "PLOTS",
    "CO_OWNERSHIP",
    "PAYMENTS",
    "DOCUMENTS",
    "BUYERS",
  ])
  category?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

@Controller("admin/activity")
@UseGuards(AuthGuard, StaffGuard)
export class ActivityController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  async list(@Req() request: AuthRequest, @Query() query: ActivityQuery) {
    if (!resolveStaffPermissions(request.auth.user).includes("audit"))
      throw new ForbiddenException("You do not have access to activity history.");
    if (query.from && query.to && new Date(query.from) > new Date(query.to))
      throw new BadRequestException("The end date must be after the start date.");
    const where = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: ["actorName", "action", "targetLabel", "detail"].map((field) => ({
              [field]: { contains: query.q, mode: "insensitive" as const },
            })),
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.activityEvent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          category: true,
          action: true,
          actorName: true,
          actorRole: true,
          targetLabel: true,
          detail: true,
          changes: true,
          createdAt: true,
        },
      }),
      this.db.activityEvent.count({ where }),
    ]);
    return { items: rows.slice(0, 50), total, nextCursor: rows.length > 50 ? rows[49].id : null };
  }
}
