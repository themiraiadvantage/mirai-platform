import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config";

export type PaystackTransaction = {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  domain: string;
  id: number | string;
  paid_at: string | null;
  customer: { email: string };
};

@Injectable()
export class PaystackService {
  // The current release intentionally supports test checkout only.
  assertConfigured() {
    if (
      !config.PAYSTACK_SECRET_KEY?.startsWith("sk_test_") ||
      !config.PAYSTACK_PUBLIC_KEY?.startsWith("pk_test_")
    )
      throw new ServiceUnavailableException("Paystack checkout is not configured.");
  }
  private async request<T>(path: string, body?: unknown): Promise<T> {
    this.assertConfigured();
    try {
      const response = await fetch(`https://api.paystack.co${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(18000),
      });
      const result = (await response.json()) as { status: boolean; data: T };
      if (!response.ok || result.status !== true || !result.data) throw new Error();
      return result.data;
    } catch {
      throw new ServiceUnavailableException(
        "Paystack could not confirm this request. Please retry from Payments; do not pay again until the status is checked.",
      );
    }
  }
  async initialize(email: string, amount: number, reference: string) {
    const data = await this.request<{ authorization_url: string; reference: string }>(
      "/transaction/initialize",
      {
        email,
        amount,
        reference,
        currency: "NGN",
        callback_url: `${config.FRONTEND_URL.replace(/\/$/, "")}/dashboard/payments/return`,
        metadata: { purpose: "plot_reservation", reference },
      },
    );
    const url = new URL(data.authorization_url);
    if (data.reference !== reference || url.origin !== "https://checkout.paystack.com")
      throw new ServiceUnavailableException("Paystack returned an unexpected checkout link.");
    return data.authorization_url;
  }
  verify(reference: string) {
    return this.request<PaystackTransaction>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
  }
  authenticateWebhook(raw: Buffer | undefined, signature: unknown) {
    this.assertConfigured();
    if (!raw || typeof signature !== "string" || !/^[a-f0-9]{128}$/i.test(signature))
      throw new UnauthorizedException("Invalid payment signature.");
    const expected = createHmac("sha512", config.PAYSTACK_SECRET_KEY!).update(raw).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
      throw new UnauthorizedException("Invalid payment signature.");
  }
}
