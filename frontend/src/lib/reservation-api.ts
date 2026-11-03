export type Reservation = {
  id: string;
  status: "PENDING" | "ACTIVE" | "FAILED" | "EXPIRED" | "REVIEW_REQUIRED";
  amount: number;
  accessMonths: number;
  termsVersion: string;
  acceptedAt: string;
  checkoutExpiresAt: string;
  accessExpiresAt: string | null;
  reviewReason: string | null;
  createdAt: string;
  snapshot: { price: string; legalFee: string; surveyFee: string; documentationFee: string };
  plot: { id: string; code: string; title: string; location: string; state: string; size: number };
  buyer?: { id: string; name: string; email: string };
  payment: {
    reference: string;
    amount: number;
    status: "PENDING" | "SUCCESS" | "FAILED";
    mode: "test";
    paidAt: string | null;
    authorizationUrl: string | null;
  } | null;
};
export type ReservationPage = {
  items: Reservation[];
  total: number;
  nextCursor: string | null;
  stats: { active: number; confirmed: number; mode: "test" };
  termsVersion: string;
};
export const reservationTermsVersion = "reservation-test-v1";
export function reservationDateParts(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("en-GB", {
      timeZone: "Africa/Lagos",
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      timeZone: "Africa/Lagos",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  };
}
export const reservationDate = (value: string) => {
  const parts = reservationDateParts(value);
  return `${parts.date}, ${parts.time}`;
};
export function checkoutUrl(value: string) {
  const url = new URL(value);
  if (url.origin !== "https://checkout.paystack.com")
    throw new Error("The checkout link is invalid. Please contact MIRAI.");
  return url.href;
}
