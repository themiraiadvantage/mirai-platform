import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard, AuthRequest } from "../auth/auth.guard";
import { StaffGuard } from "../auth/staff.guard";
import { DocumentsService } from "./documents.service";
import { PropertyService } from "./property.service";
export function sendDocument(
  res: Response,
  file: { name: string; mime: string; data: Uint8Array | null },
) {
  res.setHeader("Content-Type", file.mime);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(Buffer.from(file.data!));
}
@Controller("admin/documents")
@UseGuards(AuthGuard, StaffGuard)
export class AdminDocumentsController {
  constructor(private readonly docs: DocumentsService) {}
  @Get() list(@Req() req: AuthRequest, @Query() query: unknown) {
    return this.docs.list(req.auth.user.id, query);
  }
  @Get("plots") plots(@Req() req: AuthRequest, @Query() query: unknown) {
    return this.docs.plots(req.auth.user.id, query);
  }
  @Get("plots/:id/buyers") buyers(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: unknown,
  ) {
    return this.docs.buyers(req.auth.user.id, id, query);
  }
  @Get(":id") detail(@Req() req: AuthRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.docs.detail(req.auth.user.id, id);
  }
  @Get(":id/download") async download(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    sendDocument(res, await this.docs.download(req.auth.user.id, id));
  }
  @Get(":id/versions/:number/download") async version(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("number", ParseIntPipe) number: number,
    @Res() res: Response,
  ) {
    sendDocument(res, await this.docs.download(req.auth.user.id, id, number));
  }
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.docs.save(req.auth.user.id, body);
  }
  @Post(":id") save(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.docs.save(req.auth.user.id, body, id);
  }
  @Post(":id/remove") remove(@Req() req: AuthRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.docs.remove(req.auth.user.id, id);
  }
}
@Controller("documents")
@UseGuards(AuthGuard)
export class BuyerDocumentsController {
  constructor(
    private readonly docs: DocumentsService,
    private readonly property: PropertyService,
  ) {}
  @Get() list(@Req() req: AuthRequest, @Query() query: unknown) {
    return this.docs.buyerList(req.auth.user.id, query);
  }
  @Get(":id/download") async download(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    sendDocument(res, await this.property.asset(id, req.auth.user.id));
  }
}
