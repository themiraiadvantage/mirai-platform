import { Controller, Get, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaService } from "./database/prisma.service";
import { MailService } from "./mail/mail.service";
import { AuthService } from "./auth/auth.service";
import { AuthController } from "./auth/auth.controller";
import { AuthGuard } from "./auth/auth.guard";
import { StaffGuard } from "./auth/staff.guard";
import { AdminAuthController } from "./auth/admin.controller";
import { StaffService } from "./auth/staff.service";
import { WorkspaceSettingsService } from "./auth/settings.service";
import { ActivityController } from "./activity/activity.controller";
import { PropertyService } from "./property/property.service";
import { BuyersService } from "./property/buyers.service";
import { AdminBuyersController, BuyerProfileController } from "./property/buyers.controller";
import { DocumentsService } from "./property/documents.service";
import {
  AdminDocumentsController,
  BuyerDocumentsController,
} from "./property/documents.controller";
import { SavedPlotsController, SavedPlotsService } from "./property/saved-plots.controller";
import { CloudinaryService } from "./property/cloudinary.service";
import { PaystackService } from "./payments/paystack.service";
import { ReservationService } from "./payments/reservation.service";
import {
  ReservationsController,
  AdminReservationsController,
  AdminPaymentsController,
  PaystackWebhookController,
} from "./payments/reservation.controller";
import {
  PublicPlotsController,
  AdminPlotsController,
  AdminCoOwnershipController,
  BuyerCoOwnershipController,
} from "./property/property.controller";
import { AnnouncementsService } from "./announcements/announcements.service";
import {
  AnnouncementsController,
  AnnouncementsGuard,
  BuyerNotificationsController,
} from "./announcements/announcements.controller";

@Controller("health")
class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Get() async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
}
@Module({
  imports: [JwtModule.register({}), ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
  controllers: [
    AdminBuyersController,
    BuyerProfileController,
    AdminDocumentsController,
    BuyerDocumentsController,
    SavedPlotsController,
    ReservationsController,
    AdminReservationsController,
    AdminPaymentsController,
    PaystackWebhookController,
    AuthController,
    AdminAuthController,
    AnnouncementsController,
    BuyerNotificationsController,
    HealthController,
    ActivityController,
    PublicPlotsController,
    AdminPlotsController,
    AdminCoOwnershipController,
    BuyerCoOwnershipController,
  ],
  providers: [
    BuyersService,
    DocumentsService,
    SavedPlotsService,
    PaystackService,
    ReservationService,
    PrismaService,
    MailService,
    AuthService,
    AuthGuard,
    StaffGuard,
    StaffService,
    WorkspaceSettingsService,
    AnnouncementsService,
    AnnouncementsGuard,
    PropertyService,
    CloudinaryService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
