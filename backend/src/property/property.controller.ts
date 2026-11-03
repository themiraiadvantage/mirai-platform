import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
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
import { resolveStaffPermissions } from "../auth/staff-permissions";
import { PropertyService } from "./property.service";
import { pageInput, parse } from "./property.validation";

function access(req: AuthRequest, ...sections: string[]) {
  if (!sections.some((s) => resolveStaffPermissions(req.auth.user).includes(s)))
    throw new ForbiddenException("You do not have access to this section.");
}
function file(
  res: Response,
  asset: { mime: string; data: Uint8Array | null; name: string; deliveryUrl?: string | null },
) {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  if (asset.deliveryUrl) {
    res.redirect(302, asset.deliveryUrl);
    return;
  }
  res.setHeader("Content-Type", asset.mime);
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(Buffer.from(asset.data!));
}
@Controller("plots")
export class PublicPlotsController {
  constructor(private readonly service: PropertyService) {}
  @Get() list(@Query() query: unknown) {
    return this.service.plots(parse(pageInput, query));
  }
  @Get("assets/:id") async asset(@Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    file(res, await this.service.asset(id, "public"));
  }
  @Get(":code") plot(@Param("code") code: string) {
    return this.service.plot(code);
  }
}
@Controller("admin/plots")
@UseGuards(AuthGuard, StaffGuard)
export class AdminPlotsController {
  constructor(private readonly service: PropertyService) {}
  @Get() list(@Req() req: AuthRequest, @Query() query: unknown) {
    access(req, "plots", "catalogue");
    return this.service.plots(parse(pageInput, query), true);
  }
  @Get("assets/:id") async asset(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    access(req, "plots", "co-ownership");
    file(res, await this.service.asset(id, "admin"));
  }
  @Get(":code") plot(@Req() req: AuthRequest, @Param("code") code: string) {
    access(req, "plots", "catalogue", "co-ownership");
    return this.service.plot(code, true);
  }
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) {
    access(req, "plots");
    return this.service.savePlot(req.auth.user.id, body);
  }
  @Post(":id") save(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    access(req, "plots");
    return this.service.savePlot(req.auth.user.id, body, id);
  }
  @Post("assets/:id/remove") removeAsset(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    access(req, "plots");
    return this.service.removeAsset(req.auth.user.id, id);
  }
  @Post(":id/assets") assetUpload(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    access(req, "plots");
    return this.service.addAsset(req.auth.user.id, id, body);
  }
}
@Controller("admin/co-ownership")
@UseGuards(AuthGuard, StaffGuard)
export class AdminCoOwnershipController {
  constructor(private readonly service: PropertyService) {}
  @Get() list(@Req() req: AuthRequest, @Query() query: unknown) {
    access(req, "co-ownership");
    return this.service.requests(parse(pageInput, query));
  }
  @Get("policy") policy(@Req() req: AuthRequest) {
    access(req, "co-ownership");
    return this.service.policy();
  }
  @Get("matches/:id") match(@Req() req: AuthRequest, @Param("id", ParseUUIDPipe) id: string) {
    access(req, "co-ownership");
    return this.service.match(id);
  }
  @Get("requests/:id/candidates") candidates(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: unknown,
  ) {
    access(req, "co-ownership");
    return this.service.candidates(id, parse(pageInput, query));
  }
  @Post("policy") publishPolicy(@Req() req: AuthRequest, @Body() body: unknown) {
    access(req, "co-ownership");
    return this.service.publishPolicy(req.auth.user.id, body);
  }
  @Post("matches") propose(@Req() req: AuthRequest, @Body() body: unknown) {
    access(req, "co-ownership");
    return this.service.propose(req.auth.user.id, body);
  }
  @Post("requests/:id/cancel") cancel(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    access(req, "co-ownership");
    return this.service.cancel(req.auth.user.id, id, true);
  }
  @Post("contributions") contribution(@Req() req: AuthRequest, @Body() body: unknown) {
    access(req, "co-ownership");
    return this.service.contribute(req.auth.user.id, body);
  }
  @Post("matches/:id/allocate") allocate(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    access(req, "co-ownership");
    return this.service.allocate(req.auth.user.id, id, body);
  }
}
@Controller("co-ownership")
export class BuyerCoOwnershipController {
  constructor(private readonly service: PropertyService) {}
  @Get("summary") @UseGuards(AuthGuard) summary(@Req() req: AuthRequest) {
    return this.service.buyerSummary(req.auth.user.id);
  }
  @Get("offers") offers(@Query() query: unknown) {
    return this.service.offers(parse(pageInput, query));
  }
  @Get() @UseGuards(AuthGuard) list(@Req() req: AuthRequest, @Query() query: unknown) {
    return this.service.requests(parse(pageInput, query), req.auth.user.id);
  }
  @Post("requests") @UseGuards(AuthGuard) request(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.service.createRequest(req.auth.user.id, body);
  }
  @Post("requests/:id/accept") @UseGuards(AuthGuard) accept(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.service.accept(req.auth.user.id, id, body);
  }
  @Post("requests/:id/cancel") @UseGuards(AuthGuard) cancel(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.cancel(req.auth.user.id, id);
  }
  @Get("assets/:id") @UseGuards(AuthGuard) async asset(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    file(res, await this.service.asset(id, req.auth.user.id));
  }
}
