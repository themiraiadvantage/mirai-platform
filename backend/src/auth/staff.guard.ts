import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthRequest } from "./auth.guard";

import { staffPermissions } from "./staff-permissions";

@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    // AuthGuard loads the user from PostgreSQL for every protected request.
    // A stale access token cannot retain a removed or suspended staff role.
    const user = context.switchToHttp().getRequest<AuthRequest>().auth?.user;
    if (!user?.staffActive || !user.staffRole || !Object.hasOwn(staffPermissions, user.staffRole))
      throw new ForbiddenException("This account does not have active admin access.");
    return true;
  }
}
