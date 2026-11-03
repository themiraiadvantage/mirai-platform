import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, AuthRequest } from "../auth/auth.guard";
import { StaffGuard } from "../auth/staff.guard";
import { resolveStaffPermissions } from "../auth/staff-permissions";
import { AnnouncementsService } from "./announcements.service";
import { AnnouncementDto, AnnouncementListDto, BuyerSearchDto, PageDto } from "./announcements.dto";

@Injectable()
export class AnnouncementsGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest<AuthRequest>().auth.user;
    if (!resolveStaffPermissions(user).includes("announcements"))
      throw new ForbiddenException("You do not have access to announcements.");
    return true;
  }
}

@Controller("admin/announcements")
@UseGuards(AuthGuard, StaffGuard, AnnouncementsGuard)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}
  @Get() list(@Query() query: AnnouncementListDto) {
    return this.announcements.list(query.cursor, query.status);
  }
  @Get("buyers") buyers(@Query() query: BuyerSearchDto) {
    return this.announcements.buyers(query.q);
  }
  @Post() create(@Req() request: AuthRequest, @Body() input: AnnouncementDto) {
    return this.announcements.create(request.auth.user.id, input);
  }
  @Post(":id") update(
    @Req() request: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: AnnouncementDto,
  ) {
    return this.announcements.update(id, input, request.auth.user.id);
  }
  @Post(":id/publish")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  publish(@Req() request: AuthRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.announcements.publish(id, request.auth.user.id);
  }
}

@Controller("notifications")
@UseGuards(AuthGuard)
export class BuyerNotificationsController {
  constructor(private readonly announcements: AnnouncementsService) {}
  @Get() inbox(@Req() request: AuthRequest, @Query() query: PageDto) {
    return this.announcements.inbox(request.auth.user.id, query.cursor);
  }
  @Post("read-all") readAll(@Req() request: AuthRequest) {
    return this.announcements.readAll(request.auth.user.id);
  }
  @Post(":id/read") read(@Req() request: AuthRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.announcements.read(request.auth.user.id, id);
  }
}
