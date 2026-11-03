import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { StaffService } from "./staff.service";
import { InviteStaffDto, StaffAccessDto, StaffPermissionsDto } from "./staff.dto";
import { AuthGuard, AuthRequest } from "./auth.guard";
import { StaffGuard } from "./staff.guard";
import { resolveStaffPermissions } from "./staff-permissions";
import { WorkspaceSettingsService } from "./settings.service";
import { WorkspaceSettingsDto } from "./settings.dto";

@Controller("admin/auth")
@UseGuards(AuthGuard, StaffGuard)
export class AdminAuthController {
  constructor(
    private readonly staff: StaffService,
    private readonly settings: WorkspaceSettingsService,
  ) {}
  @Get("settings")
  getSettings() {
    return this.settings.get();
  }
  @Post("settings")
  saveSettings(@Req() request: AuthRequest, @Body() body: WorkspaceSettingsDto) {
    return this.settings.save(request.auth.user.id, body);
  }
  @Get("me")
  me(@Req() request: AuthRequest) {
    return { user: request.auth.user, permissions: resolveStaffPermissions(request.auth.user) };
  }
  @Get("staff")
  list(@Req() request: AuthRequest) {
    return this.staff.list(request.auth.user.id);
  }
  @Post("invitations")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  invite(@Req() request: AuthRequest, @Body() body: InviteStaffDto) {
    return this.staff.invite(body, request.auth.user.id);
  }
  @Post("staff/:id/access")
  access(@Req() request: AuthRequest, @Param("id") id: string, @Body() body: StaffAccessDto) {
    return this.staff.setActive(request.auth.user.id, id, body.active);
  }
  @Post("staff/:id/permissions")
  permissions(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: StaffPermissionsDto,
  ) {
    return this.staff.setPermissions(request.auth.user.id, id, body);
  }
}
