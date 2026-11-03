import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard, AuthRequest } from "../auth/auth.guard";
import { StaffGuard } from "../auth/staff.guard";
import { BuyersService } from "./buyers.service";
@Controller("admin/buyers")
@UseGuards(AuthGuard, StaffGuard)
export class AdminBuyersController {
  constructor(private readonly buyers: BuyersService) {}
  @Get() list(@Req() req: AuthRequest, @Query() query: unknown) {
    return this.buyers.list(req.auth.user.id, query);
  }
  @Get(":id") detail(@Req() req: AuthRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.buyers.detail(req.auth.user.id, id);
  }
  @Get(":id/records") records(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: unknown,
  ) {
    return this.buyers.records(req.auth.user.id, id, query);
  }
  @Post(":id") save(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.buyers.save(req.auth.user.id, id, body);
  }
}
@Controller("profile")
@UseGuards(AuthGuard)
export class BuyerProfileController {
  constructor(private readonly buyers: BuyersService) {}
  @Get() get(@Req() req: AuthRequest) {
    return this.buyers.profile(req.auth.user.id);
  }
  @Post() save(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.buyers.save(req.auth.user.id, req.auth.user.id, body, false);
  }
}
