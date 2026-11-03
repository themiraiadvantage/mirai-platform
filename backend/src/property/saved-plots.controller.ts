import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, AuthRequest } from "../auth/auth.guard";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";
import { parse } from "./property.validation";

const input = z.object({ plotId: z.string().uuid(), saved: z.boolean() }).strict();
const queryInput = z
  .object({
    cursor: z.string().uuid().optional(),
    q: z.string().trim().max(128).optional(),
    state: z.string().trim().max(100).optional(),
  })
  .strict();
@Injectable()
export class SavedPlotsService {
  constructor(private readonly db: PrismaService) {}
  private async buyer(userId: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.staffRole || !user.emailVerifiedAt)
      throw new ForbiddenException("Use a verified customer account to save plots.");
  }
  async ids(userId: string) {
    await this.buyer(userId);
    const rows = await this.db.savedPlot.findMany({ where: { userId }, select: { plotId: true } });
    return { ids: rows.map((r) => r.plotId), total: rows.length };
  }
  async save(userId: string, body: unknown) {
    await this.buyer(userId);
    const data = parse(input, body);
    if (!data.saved) {
      await this.db.savedPlot.deleteMany({ where: { userId, plotId: data.plotId } });
      return { plotId: data.plotId, saved: false };
    }
    const plot = await this.db.propertyPlot.findFirst({
      where: { id: data.plotId, publication: "Published" },
      select: { id: true },
    });
    if (!plot) throw new NotFoundException("This listing is no longer available to save.");
    await this.db.savedPlot.upsert({
      where: { userId_plotId: { userId, plotId: data.plotId } },
      create: { userId, plotId: data.plotId },
      update: {},
    });
    return { plotId: data.plotId, saved: true };
  }
  async list(userId: string, query: unknown) {
    await this.buyer(userId);
    const q = parse(queryInput, query);
    const where: Prisma.SavedPlotWhereInput = {
      userId,
      ...(q.q || q.state
        ? {
            plot: {
              publication: "Published",
              ...(q.state ? { state: q.state } : {}),
              ...(q.q
                ? {
                    OR: ["code", "title", "location", "state"].map((field) => ({
                      [field]: { contains: q.q, mode: "insensitive" },
                    })),
                  }
                : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.savedPlot.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 31,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
        include: {
          plot: {
            select: {
              id: true,
              code: true,
              title: true,
              location: true,
              state: true,
              size: true,
              price: true,
              availability: true,
              publication: true,
              assets: {
                where: { kind: "PHOTO" },
                take: 1,
                orderBy: { createdAt: "asc" },
                select: { id: true },
              },
            },
          },
        },
      }),
      this.db.savedPlot.count({ where }),
    ]);
    return {
      items: rows
        .slice(0, 30)
        .map((r) => ({
          id: r.id,
          plotId: r.plotId,
          savedAt: r.createdAt,
          plot: r.plot.publication === "Published" ? { ...r.plot, publication: undefined } : null,
        })),
      total,
      nextCursor: rows.length > 30 ? rows[29].id : null,
    };
  }
}
@Controller("saved-plots")
@UseGuards(AuthGuard)
export class SavedPlotsController {
  constructor(private readonly service: SavedPlotsService) {}
  @Get("ids") ids(@Req() req: AuthRequest) {
    return this.service.ids(req.auth.user.id);
  }
  @Get() list(@Req() req: AuthRequest, @Query() query: unknown) {
    return this.service.list(req.auth.user.id, query);
  }
  @Post() save(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.service.save(req.auth.user.id, body);
  }
}
