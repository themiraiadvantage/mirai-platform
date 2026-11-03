"use client";
import { useSyncExternalStore } from "react";
import { OWNED, getPlot, planSchedule, RESERVATION_FEE, type Owned, type StaffRole } from "./data";
import type { Session } from "./session";

export interface Receipt {
  id: string;
  code: string;
  amount: number;
  date: string;
  method: string;
  kind: string;
}
export interface DemoState {
  owned: Owned[];
  receipts: Receipt[];
  saved: string[];
  read: number[];
  preferences: Record<string, boolean>;
  matching?: { code: string; deposit: number; location: string };
  audit: {
    actor: string;
    role: StaffRole;
    action: string;
    target: string;
    before: string;
    after: string;
    t: string;
    ip: string;
  }[];
}
const listeners = new Set<() => void>();
let cached: DemoState | undefined;
let currentKey = "";
const initial = (session?: Session | null): DemoState => ({
  owned:
    session?.email === "amaka@demo.mirai.ng"
      ? structuredClone(OWNED)
      : session?.email === "tunde@demo.mirai.ng"
        ? structuredClone(OWNED.slice(0, 1))
        : [],
  receipts: [],
  saved: [],
  read: [],
  preferences: { email: true, SMS: false, WhatsApp: false },
  audit: [],
});
function key() {
  try {
    const s = JSON.parse(localStorage.getItem("mirai-session") || "null");
    return { key: `mirai-data:${s?.email || "visitor"}`, session: s as Session | null };
  } catch {
    return { key: "mirai-data:visitor", session: null };
  }
}
function snapshot() {
  const k = key();
  if (cached && currentKey === k.key) return cached;
  currentKey = k.key;
  try {
    cached = JSON.parse(localStorage.getItem(k.key) || "null") || initial(k.session);
  } catch {
    cached = initial(k.session);
  }
  return cached!;
}
export function useDemo() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    snapshot,
    () => undefined,
  );
}
export function mutateDemo(fn: (state: DemoState) => DemoState) {
  cached = fn(snapshot());
  localStorage.setItem(currentKey, JSON.stringify(cached));
  listeners.forEach((l) => l());
}
export function recordPayment(
  code: string,
  amount: number,
  method: string,
  kind: string,
  instalment?: number,
) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be positive");
  const existing = snapshot().owned.find((o) => o.code === code);
  if (instalment !== undefined && existing?.instalments[instalment]?.status === "Paid") return null;
  if (
    instalment !== undefined &&
    (!existing?.instalments[instalment] || existing.instalments[instalment].amount !== amount)
  )
    throw new Error("Payment must match the scheduled instalment");
  const receipt: Receipt = {
    id: `MR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    code,
    amount,
    method,
    kind,
    date: new Date().toISOString(),
  };
  mutateDemo((s) => ({
    ...s,
    receipts: [receipt, ...s.receipts],
    owned: s.owned.some((o) => o.code === code)
      ? s.owned.map((o) =>
          o.code === code
            ? {
                ...o,
                paid: o.paid + (kind === "Reservation + access fee" ? 0 : amount),
                stage:
                  instalment === undefined || o.stage === "Documentation" || o.stage === "Complete"
                    ? o.stage
                    : "Payment",
                instalments: o.instalments.map((i, n) =>
                  n === instalment ? { ...i, status: "Paid" } : i,
                ),
              }
            : o,
        )
      : [...s.owned, { code, stage: "Reservation", paid: 0, plan: "Outright", instalments: [] }],
  }));
  return receipt;
}
export function toggleSaved(code: string) {
  mutateDemo((s) => ({
    ...s,
    saved: s.saved.includes(code) ? s.saved.filter((c) => c !== code) : [...s.saved, code],
  }));
}
export function reservePlot(code: string, plan: Owned["plan"], method: string) {
  const plot = getPlot(code);
  if (!plot) throw new Error("Plot not found");
  if (snapshot().owned.some((o) => o.code === code)) return false;
  const schedule = planSchedule(plot.price, plan);
  const monthly = Math.floor(schedule.total / schedule.months);
  const reservedAt = new Date();
  const accessExpiresAt = new Date(reservedAt);
  accessExpiresAt.setFullYear(accessExpiresAt.getFullYear() + 1);
  const instalments = Array.from({ length: schedule.months }, (_, i) => ({
    due: new Date(reservedAt.getFullYear(), reservedAt.getMonth() + i + 1, 5).toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    ),
    amount: i === schedule.months - 1 ? schedule.total - monthly * i : monthly,
    status: "Upcoming" as const,
  }));
  recordPayment(code, RESERVATION_FEE, method, "Reservation + access fee");
  mutateDemo((s) => ({
    ...s,
    owned: s.owned.map((o) =>
      o.code === code
        ? {
            ...o,
            plan,
            instalments,
            reservedAt: reservedAt.toISOString(),
            accessExpiresAt: accessExpiresAt.toISOString(),
          }
        : o,
    ),
  }));
  return true;
}
export function downloadText(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadReceipt(r: Receipt) {
  downloadText(
    `${r.id}.html`,
    `<!doctype html><html><meta charset="utf-8"><title>MIRAI demo receipt</title><style>body{font:16px system-ui;max-width:650px;margin:70px auto;padding:30px;color:#00101a}h1{font-family:Georgia}dl{line-height:2}small{color:#666}@media print{button{display:none}}</style><img src="${new URL("/brand/mirai-logo-no-tagline.png", window.location.origin).href}" width="220" height="110" alt="MIRAI" style="display:block;object-fit:contain"><h1>Payment receipt</h1><p>DEMO PAYMENT RECEIPT: NO MONEY MOVED</p><hr><h2>${r.code}</h2><dl><dt>Reference: ${r.id}</dt><dt>Amount: NGN ${r.amount.toLocaleString("en-NG")}</dt><dt>Purpose: ${r.kind}</dt><dt>Method: ${r.method}</dt><dt>Date: ${new Date(r.date).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</dt></dl><hr><small>This is a simulated receipt for frontend demonstration. It is not proof of payment or land ownership.</small><p>Use your browser’s Print menu to save as PDF.</p></html>`,
    "text/html",
  );
}
