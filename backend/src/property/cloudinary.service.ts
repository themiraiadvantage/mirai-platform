import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { config } from "../config";
import { PrismaService } from "../database/prisma.service";

export type CloudinaryPhoto = { publicId: string; url: string; format: string; version: number };

@Injectable()
export class CloudinaryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CloudinaryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private cleaning = false;
  constructor(private readonly db: PrismaService) {
    cloudinary.config({
      cloud_name: config.CLOUDINARY_CLOUD_NAME,
      api_key: config.CLOUDINARY_API_KEY,
      api_secret: config.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  private configured() {
    return !!(
      config.CLOUDINARY_CLOUD_NAME &&
      config.CLOUDINARY_API_KEY &&
      config.CLOUDINARY_API_SECRET
    );
  }
  onModuleInit() {
    if (config.NODE_ENV === "test" || !this.configured()) return;
    this.timer = setInterval(() => void this.cleanup(), 60000);
    this.timer.unref();
    void this.cleanup();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async uploadPhoto(bytes: Buffer, mime: string): Promise<CloudinaryPhoto> {
    if (!this.configured())
      throw new ServiceUnavailableException(
        "Plot photo storage is not configured. Please contact the platform owner.",
      );
    const publicId = `mirai/plots/${randomUUID()}`;
    // This durable lease survives process crashes and failed database commits.
    await this.db.cloudinaryCleanup.create({
      data: { publicId, notBefore: new Date(Date.now() + 3600000) },
    });
    try {
      const result = await cloudinary.uploader.upload(
        `data:${mime};base64,${bytes.toString("base64")}`,
        {
          public_id: publicId,
          resource_type: "image",
          type: "authenticated",
          overwrite: false,
          allowed_formats: ["jpg", "png", "webp"],
          timeout: 20000,
        },
      );
      if (
        result.public_id !== publicId ||
        !["jpg", "png", "webp"].includes(result.format) ||
        !result.secure_url?.startsWith("https://res.cloudinary.com/")
      )
        throw new Error("Unexpected upload result");
      return { publicId, url: result.secure_url, format: result.format, version: result.version };
    } catch {
      // The remote upload may have finished even when its response timed out.
      // Leave the lease for the worker; do not race a still-running upload.
      throw new ServiceUnavailableException(
        "Cloudinary could not upload this photo. Please try again.",
      );
    }
  }
  deliveryUrl(photo: {
    cloudinaryPublicId: string;
    cloudinaryFormat: string | null;
    cloudinaryVersion: number | null;
  }) {
    if (!this.configured())
      throw new ServiceUnavailableException("Plot photo storage is not configured.");
    return cloudinary.url(photo.cloudinaryPublicId, {
      resource_type: "image",
      type: "authenticated",
      secure: true,
      sign_url: true,
      format: photo.cloudinaryFormat || undefined,
      version: photo.cloudinaryVersion || undefined,
    });
  }
  async cleanup() {
    if (this.cleaning || !this.configured()) return;
    this.cleaning = true;
    try {
      const jobs = await this.db.cloudinaryCleanup.findMany({
        where: { notBefore: { lte: new Date() } },
        orderBy: { notBefore: "asc" },
        take: 10,
      });
      for (const job of jobs) {
        try {
          // A successful commit with a lost response must never delete a live photo.
          const attached = await this.db.plotAsset.findUnique({
            where: { cloudinaryPublicId: job.publicId },
            select: { id: true },
          });
          if (!attached) {
            const destroyOptions = {
              resource_type: "image" as const,
              type: "authenticated" as const,
              invalidate: true,
              timeout: 15000,
            };
            const result = await cloudinary.uploader.destroy(job.publicId, destroyOptions);
            if (!["ok", "not found"].includes(result.result)) continue;
          }
          await this.db.cloudinaryCleanup.deleteMany({ where: { publicId: job.publicId } });
        } catch {
          this.logger.warn("A plot photo cleanup will be retried.");
        }
      }
    } catch {
      this.logger.warn("Plot photo cleanup is temporarily unavailable.");
    } finally {
      this.cleaning = false;
    }
  }
}
