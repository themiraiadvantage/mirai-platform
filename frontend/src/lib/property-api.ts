"use client";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "./api";
import { authenticatedRequest } from "./announcement-api";
import { getAccessToken, useSession } from "./session";
import type { Plot } from "./data";

export type Asset = {
  id: string;
  name: string;
  mime: string;
  kind: "PHOTO" | "LISTING_DOCUMENT" | "PRIVATE_DOCUMENT";
};
export type PublicationIssue = {
  section: "Details" | "Pricing" | "Files" | "Map & boundaries" | "Publish";
  message: string;
  code: string;
};
export function publicationIssuesFromError(error: unknown): PublicationIssue[] {
  if (!error || typeof error !== "object" || !("details" in error)) return [];
  const details = error.details;
  if (
    !details ||
    typeof details !== "object" ||
    !("publicationIssues" in details) ||
    !Array.isArray(details.publicationIssues)
  )
    return [];
  return details.publicationIssues.filter(
    (item): item is PublicationIssue =>
      !!item &&
      typeof item === "object" &&
      typeof item.message === "string" &&
      typeof item.code === "string" &&
      ["Details", "Pricing", "Files", "Map & boundaries", "Publish"].includes(item.section),
  );
}
export type LivePlot = {
  id: string;
  code: string;
  title: string;
  description: string;
  location: string;
  lga: string;
  state: string;
  size: number;
  price: number | string;
  legalFee: number | string;
  surveyFee: number | string;
  documentationFee: number | string;
  reservationFee: number | string;
  accessMonths: number;
  publication: "Draft" | "Published" | "Archived";
  availability: "Available" | "Reserved" | "Sold";
  verification: "unchecked" | "pending" | "in_progress" | "verified";
  coEnabled: boolean;
  coMonths: number;
  coDepositPercent: number;
  version: number;
  updatedAt: string;
  createdAt?: string;
  details: {
    plans: ("Outright" | "3mo" | "6mo")[];
    latitude: number;
    longitude: number;
    siteStatus: string;
    docSummary: string;
    notes?: string;
    beacons?: { id: string; lat: number; lng: number }[];
    checks?: {
      key: string;
      label: string;
      result: "ok" | "further" | "nodata";
      source: string;
      date: string;
      reviewer: string;
      notes: string;
    }[];
  };
  assets: Asset[];
};
export type Policy = {
  id: string;
  version: number;
  title: string;
  body: string;
  createdAt: string;
};
export type Offer = {
  sharePercent: number;
  land: number;
  legalFee: number;
  surveyFee: number;
  documentationFee: number;
  total: number;
  deposit: number;
  months: number;
};
export type Contribution = {
  id: string;
  amount: string | number;
  reference: string;
  receivedAt: string;
};
export type CoSummary = {
  active: number;
  allocated: number;
  waiting: number;
  proposed: number;
  confirmed: string | number;
  states: string[];
};
export type Allocation = { id: string; userId: string; portion: string; documentId: string };
export type CoRequest = {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string };
  plotId: string;
  plot: LivePlot;
  policyId: string;
  policy: Policy;
  offer: Offer;
  preference: string;
  status: "WAITING" | "PROPOSED" | "ACTIVE" | "ALLOCATED" | "CANCELLED";
  matchId: string | null;
  acceptedAt: string | null;
  createdAt: string;
  contributions: Contribution[];
  match: {
    id: string;
    status: string;
    agreement: string;
    requests: { id: string; userId: string; acceptedAt: string | null; user: { name: string } }[];
    allocations: Allocation[];
  } | null;
};
export type Match = {
  id: string;
  status: string;
  agreement: string;
  notes: string;
  plot: LivePlot;
  requests: CoRequest[];
  allocations: Allocation[];
};
export type Page<T> = { items: T[]; nextCursor: string | null; total: number };
export const coStatus: Record<string, string> = {
  WAITING: "Waiting for a partner",
  PROPOSED: "Agreement review",
  ACTIVE: "Contributions in progress",
  ALLOCATED: "Allocated",
  CANCELLED: "Cancelled",
};
export const paidAmount = (r: CoRequest) =>
  r.contributions.reduce((sum, c) => sum + Number(c.amount), 0);
export const propertyNaira = (amount: number) =>
  "₦" + amount.toLocaleString("en-NG", { maximumFractionDigits: 2 });
export function usePropertySearch(value: string) {
  const [search, setSearch] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(value), 300);
    return () => clearTimeout(timer);
  }, [value]);
  return search;
}
export function mapPlot(p: LivePlot): Plot {
  const beacons = p.details.beacons || [];
  const lats = beacons.map((b) => b.lat),
    lngs = beacons.map((b) => b.lng);
  const minLat = Math.min(...lats),
    minLng = Math.min(...lngs);
  const height = Math.max(...lats) - minLat || 1,
    width = Math.max(...lngs) - minLng || 1;
  return {
    code: p.code,
    location: p.location,
    lga: p.lga,
    state: p.state as Plot["state"],
    size: p.size,
    price: Number(p.price),
    plans: p.details.plans,
    status: p.verification,
    siteStatus: p.details.siteStatus as Plot["siteStatus"],
    docSummary: p.details.docSummary,
    beacons,
    centre: [p.details.latitude, p.details.longitude],
    shape: beacons.map((b) => [
      10 + ((b.lng - minLng) / width) * 80,
      90 - ((b.lat - minLat) / height) * 80,
    ]),
    docs: [],
    checks: [],
    photo: 0,
  };
}
export const post = <T>(path: string, body: unknown = {}) =>
  authenticatedRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
export function assetUrl(id: string) {
  return `${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1").replace(/\/$/, "")}/plots/assets/${id}`;
}
export async function openPrivateAsset(id: string, admin = false) {
  const token = await getAccessToken();
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1").replace(
    /\/$/,
    "",
  );
  const response = await fetch(`${base}/${admin ? "admin/plots" : "co-ownership"}/assets/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Could not open this document. Please try again.");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = response.headers.get("Content-Type")?.includes("pdf")
    ? "mirai-document.pdf"
    : "mirai-file";
  a.rel = "noopener";
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function uploadAsset(plotId: string, file: File, kind: Asset["kind"]) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose a file up to 5 MB.");
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
  return post<Asset>(`/admin/plots/${plotId}/assets`, {
    name: file.name,
    mime: file.type,
    kind,
    base64,
  });
}
export function usePropertyResource<T>(path: string, authenticated = true, enabled = true) {
  const session = useSession();
  const [state, setState] = useState<{
    data: T | null;
    error: string;
    loading: boolean;
    key: string;
  }>({ data: null, error: "", loading: true, key: "" });
  const [revision, setRevision] = useState(0);
  const key = `${authenticated ? (session?.id ?? "") : "public"}:${path}:${enabled}`;
  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState({ data: null, key, loading: false, error: "" });
      return;
    }
    setState((s) => ({ ...s, data: s.key === key ? s.data : null, key, loading: true, error: "" }));
    (authenticated ? authenticatedRequest<T>(path) : apiRequest<T>(path))
      .then((data) => {
        if (active) setState({ data, key, loading: false, error: "" });
      })
      .catch((e) => {
        if (active)
          setState({
            data: null,
            key,
            loading: false,
            error: e instanceof Error ? e.message : "Could not load records.",
          });
      });
    return () => {
      active = false;
    };
  }, [path, authenticated, key, revision, enabled]);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  return { ...state, data: state.key === key ? state.data : null, refresh };
}
