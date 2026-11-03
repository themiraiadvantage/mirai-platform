import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { config } from "../config";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const schema = new URL(config.DATABASE_URL).searchParams.get("schema") || "public";
    super({
      adapter: new PrismaPg(
        { connectionString: config.DATABASE_URL, connectionTimeoutMillis: 10000, max: 10 },
        { schema },
      ),
      // Allow a pooled Neon connection to open before starting a transaction.
      transactionOptions: { maxWait: 10000, timeout: 15000 },
    });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
