import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard, AuthRequest } from "../auth/auth.guard";
import { StaffGuard } from "../auth/staff.guard";
import { pageInput, parse } from "../property/property.validation";
import { ReservationService } from "./reservation.service";
import type { Request } from "express";

@Controller("reservations")
@UseGuards(AuthGuard)
export class ReservationsController {
  constructor(private readonly service: ReservationService) {}
  @Get() list(@Req() req: AuthRequest, @Query() query: unknown) {
    return this.service.list(req.auth.user.id, parse(pageInput, query));
  }
  @Post("checkout") checkout(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.service.initialize(req.auth.user.id, body);
  }
  @Post("verify") verify(@Req() req: AuthRequest, @Body("reference") reference: unknown) {
    return this.service.verify(req.auth.user.id, reference);
  }
}
@Controller("admin/reservations")
@UseGuards(AuthGuard, StaffGuard)
export class AdminReservationsController {
  constructor(private readonly service: ReservationService) {}
  @Get() list(@Req() req: AuthRequest, @Query() query: unknown) {
    return this.service.list(req.auth.user.id, parse(pageInput, query), "reservations");
  }
}
@Controller("admin/payments")
@UseGuards(AuthGuard, StaffGuard)
export class AdminPaymentsController {
  constructor(private readonly service: ReservationService) {}
  @Get() list(@Req() req: AuthRequest, @Query() query: unknown) {
    return this.service.list(req.auth.user.id, parse(pageInput, query), "payments");
  }
  @Post("verify") verify(@Req() req: AuthRequest, @Body("reference") reference: unknown) {
    return this.service.verify(req.auth.user.id, reference, true);
  }
}
@Controller("payments/paystack")
export class PaystackWebhookController {
  constructor(private readonly service: ReservationService) {}
  @Post("webhook") @HttpCode(200) webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-paystack-signature") signature: unknown,
    @Body() body: unknown,
  ) {
    return this.service.webhook(req.rawBody, signature, body);
  }
}
