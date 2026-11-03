"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type ComponentType,
} from "react";
import { adminRequest } from "./admin-auth";
import { PLOTS, STAFF, type Plot, type StaffRole } from "@/lib/data";
import { plotPhoto } from "@/lib/photos";
import { WorkspaceLoading } from "@/components/mirai/WorkspaceLoading";

export type Publication = "Draft" | "Published" | "Archived";
export type AdminPlot = Plot & {
  title: string;
  description: string;
  availability: "Available" | "Reserved" | "Sold";
  publication: Publication;
  cover: string;
  photos: { id: string; name: string }[];
  legalFee: number;
  surveyFee: number;
  documentationFee: number;
  reservationFee: number;
  accessMonths: number;
  notes: string;
  updatedAt: string;
  siteReviewer?: string;
  siteMethod?: string;
  siteCheckedAt?: string;
  siteNextAction?: string;
  siteNotes?: string;
};
export type AdminDocument = {
  id: string;
  name: string;
  plot: string;
  buyer: string;
  category: string;
  visibility: "Listing" | "Buyer only" | "Staff only";
  status: "Awaiting review" | "Approved" | "Changes requested";
  reviewer: string;
  reviewedAt: string;
  notes: string;
  versions: { id: string; name: string; size: number; date: string }[];
};
export type Buyer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  joined: string;
  notes: string;
};
export type Reservation = {
  id: string;
  buyer: string;
  plot: string;
  date: string;
  expires: string;
  plan: string;
  agreedPrice?: number;
  status: "Active" | "Cancelled" | "Completed";
  stage: string;
};
export type Payment = {
  id: string;
  buyer: string;
  plot: string;
  amount: number;
  kind: string;
  method: string;
  date: string;
  status: "Confirmed" | "Pending" | "Failed";
  reference: string;
  note: string;
};
export type Announcement = {
  id: string;
  title: string;
  body: string;
  target: string;
  status: "Draft" | "Published";
  date: string;
};
export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
};
export type AdminData = {
  plots: AdminPlot[];
  documents: AdminDocument[];
  buyers: Buyer[];
  reservations: Reservation[];
  payments: Payment[];
  announcements: Announcement[];
  staff: StaffMember[];
  matches: {
    id: string;
    plot: string;
    firstBuyer: string;
    secondBuyer: string;
    status: string;
    deposit: number;
    notes: string;
  }[];
  audit: {
    id: string;
    date: string;
    actor: string;
    action: string;
    target: string;
    detail: string;
  }[];
  settings: {
    company: string;
    email: string;
    phone: string;
    reservationFee: number;
    accessMonths: number;
  };
};
export const ADMIN_STORAGE_KEY = "mirai-admin-preview-v2";
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const dateLabel = (date: string) =>
  date
    ? new Date(date).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not recorded";

export function createAdminData(): AdminData {
  return {
    plots: PLOTS.map((p, i) => ({
      ...structuredClone(p),
      title: `${p.location} ${p.size} sqm plot`,
      description: `A ${p.size} sqm plot in ${p.location}, ${p.state}. Review the survey boundaries, available documentation and site findings before proceeding. This listing is sample data for the admin preview.`,
      availability: i === 0 || i === 7 ? "Reserved" : i === 6 ? "Sold" : "Available",
      publication: i > 8 ? "Draft" : "Published",
      cover: plotPhoto(p.photo),
      photos: [],
      legalFee: Math.round(p.price * 0.05),
      surveyFee: 350000,
      documentationFee: 250000,
      reservationFee: 30000,
      accessMonths: 12,
      notes: "",
      updatedAt: "2026-10-24T10:00:00Z",
    })),
    documents: PLOTS.slice(0, 8).flatMap((p, i) =>
      p.docs.slice(0, 2).map((d, j) => ({
        id: `DOC-${i}${j}`,
        name: d.name,
        plot: p.code,
        buyer: "",
        category: d.name,
        visibility: "Listing" as const,
        status: i % 3 === 0 ? ("Awaiting review" as const) : ("Approved" as const),
        reviewer: "Ifeoma Nwosu",
        reviewedAt: i % 3 === 0 ? "" : "2026-10-20T10:00:00Z",
        notes:
          "Illustrative document record. Upload a sample file to test viewing and version history.",
        versions: [],
      })),
    ),
    buyers: [
      {
        id: "BUY-001",
        name: "Amaka Okafor",
        email: "amaka@example.invalid",
        phone: "+234 800 000 0101",
        location: "London, UK",
        joined: "2026-05-02",
        notes: "Prefers email updates. Interested in plots in Epe.",
      },
      {
        id: "BUY-002",
        name: "Tunde Balogun",
        email: "tunde@example.invalid",
        phone: "+234 800 000 0102",
        location: "Lagos, Nigeria",
        joined: "2026-07-18",
        notes: "Requested a copy of the updated survey plan.",
      },
      {
        id: "BUY-003",
        name: "Zara Adeyemi",
        email: "zara@example.invalid",
        phone: "+234 800 000 0103",
        location: "Abuja, Nigeria",
        joined: "2026-10-12",
        notes: "Considering co-ownership in Ogun State.",
      },
    ],
    reservations: [
      {
        id: "RES-001",
        buyer: "BUY-001",
        plot: "MR-4092",
        date: "2026-05-05",
        expires: "2027-05-05",
        plan: "6mo",
        status: "Active",
        stage: "Payment",
      },
      {
        id: "RES-002",
        buyer: "BUY-002",
        plot: "MR-5011",
        date: "2026-03-02",
        expires: "2027-03-02",
        plan: "Outright",
        status: "Completed",
        stage: "Documentation",
      },
      {
        id: "RES-003",
        buyer: "BUY-001",
        plot: "MR-5024",
        date: "2026-10-18",
        expires: "2027-10-18",
        plan: "3mo",
        status: "Active",
        stage: "Reservation",
      },
    ],
    payments: [
      {
        id: "PAY-001",
        buyer: "BUY-001",
        plot: "MR-4092",
        amount: 1190000,
        kind: "Instalment",
        method: "Card",
        date: "2026-10-05",
        status: "Confirmed",
        reference: "MIRAI-SAMPLE-1001",
        note: "Sample gateway confirmation.",
      },
      {
        id: "PAY-002",
        buyer: "BUY-001",
        plot: "MR-5024",
        amount: 30000,
        kind: "Reservation",
        method: "Bank transfer",
        date: "2026-10-18",
        status: "Pending",
        reference: "MIRAI-SAMPLE-1002",
        note: "Awaiting reconciliation against the sample bank statement.",
      },
      {
        id: "PAY-003",
        buyer: "BUY-002",
        plot: "MR-5011",
        amount: 3200000,
        kind: "Land payment",
        method: "Bank transfer",
        date: "2026-10-02",
        status: "Confirmed",
        reference: "MIRAI-SAMPLE-1003",
        note: "Sample full payment.",
      },
      {
        id: "PAY-004",
        buyer: "BUY-001",
        plot: "MR-4092",
        amount: 1190000,
        kind: "Instalment",
        method: "Card",
        date: "2026-10-22",
        status: "Failed",
        reference: "MIRAI-SAMPLE-1004",
        note: "Sample declined transaction. No funds received.",
      },
      {
        id: "PAY-005",
        buyer: "BUY-003",
        plot: "MR-4105",
        amount: 475000,
        kind: "Co-ownership deposit",
        method: "Bank transfer",
        date: "2026-10-23",
        status: "Pending",
        reference: "MIRAI-SAMPLE-1005",
        note: "Sample matching deposit awaiting review.",
      },
    ],
    announcements: [
      {
        id: "ANN-001",
        title: "Your ownership records, all in one place",
        body: "Visit your Land Library to review your plot documents, payment schedule and latest verification updates.",
        target: "All buyers",
        status: "Published",
        date: "2026-10-20T10:00:00Z",
      },
      {
        id: "ANN-002",
        title: "Upcoming site inspection in Epe",
        body: "We are preparing a new inspection update for Epe buyers. Confirmed findings will be added to your plot record after review.",
        target: "MR-4092",
        status: "Draft",
        date: "2026-10-24T10:00:00Z",
      },
    ],
    staff: STAFF.map((s, i) => ({
      ...s,
      email: `staff${i + 1}@example.invalid`,
      id: `STAFF-${i + 1}`,
    })),
    matches: [
      {
        id: "MATCH-001",
        plot: "MR-4105",
        firstBuyer: "BUY-003",
        secondBuyer: "",
        status: "Looking for partner",
        deposit: 475000,
        notes:
          "Preferred area: Ibeju-Lekki. Sample matching request; no allocation has been agreed.",
      },
    ],
    audit: [
      {
        id: "LOG-001",
        date: "2026-10-24T10:15:00Z",
        actor: "Ifeoma Nwosu",
        action: "Document reviewed",
        target: "MR-5011",
        detail: "Title document approved in the sample workspace.",
      },
      {
        id: "LOG-002",
        date: "2026-10-24T09:30:00Z",
        actor: "Tunde Bakare",
        action: "Listing updated",
        target: "MR-4092",
        detail: "Sample plot description and photography updated.",
      },
      {
        id: "LOG-003",
        date: "2026-10-23T14:00:00Z",
        actor: "Adaeze Okafor",
        action: "Announcement drafted",
        target: "Epe inspection",
        detail: "Prepared for review before publication.",
      },
    ],
    settings: {
      company: "MIRAI",
      email: "hello@mirai.ng",
      phone: "+234 800 000 0000",
      reservationFee: 30000,
      accessMonths: 12,
    },
  };
}

export function publicationIssues(plot: AdminPlot, documents: AdminDocument[]) {
  return [
    !plot.title.trim() && "Add a listing title",
    !plot.location.trim() && "Add a location",
    !plot.lga.trim() && "Add a local government area",
    plot.size <= 0 && "Enter a plot size",
    plot.price <= 0 && "Enter a land price",
    !plot.description.trim() && "Write a description",
    !plot.plans.length && "Select a payment plan",
    !plot.cover && !plot.photos.length && "Add a cover photo",
    plot.beacons.length < 3 && "Add at least three boundary beacons",
    (plot.beacons.some(
      (b) =>
        !Number.isFinite(b.lat) ||
        !Number.isFinite(b.lng) ||
        Math.abs(b.lat) > 90 ||
        Math.abs(b.lng) > 180,
    ) ||
      (plot.beacons.length >= 3 &&
        (new Set(plot.beacons.map((b) => `${b.lat},${b.lng}`)).size < 3 ||
          new Set(plot.beacons.map((b) => b.id.trim())).size !== plot.beacons.length ||
          plot.beacons.some((b) => !b.id.trim())))) &&
      "Correct the beacon coordinates",
    !documents.some((d) => d.plot === plot.code && d.visibility === "Listing") &&
      "Attach a listing document record",
  ].filter(Boolean) as string[];
}

type Store = {
  data: AdminData;
  update: (
    action: string,
    target: string,
    recipe: (draft: AdminData) => void,
    detail?: string,
  ) => void;
  reset: () => void;
  storageError: string;
};
const Context = createContext<Store | null>(null);

export function AdminProvider({
  children,
  storageKey = ADMIN_STORAGE_KEY,
  actor = "Preview owner",
  liveSettings = false,
  frame: Frame,
}: {
  children: ReactNode;
  storageKey?: string;
  actor?: string;
  liveSettings?: boolean;
  frame?: ComponentType<{ children: ReactNode }>;
}) {
  const [data, setData] = useState<AdminData | null>(null);
  const [frameData] = useState(createAdminData);
  const [storageError, setStorageError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setSettingsError("");
    let initial: AdminData;
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : null;
      initial =
        parsed && Array.isArray(parsed.plots) && Array.isArray(parsed.documents) && parsed.settings
          ? parsed
          : createAdminData();
    } catch {
      initial = createAdminData();
      setStorageError("Browser storage is unavailable. Changes will last for this visit only.");
    }
    if (!liveSettings) setData(initial);
    else {
      setData(null);
      adminRequest<AdminData["settings"]>("/settings")
        .then((settings) => {
          if (!cancelled) setData({ ...initial, settings });
        })
        .catch((error) => {
          if (!cancelled)
            setSettingsError(
              error instanceof Error ? error.message : "Could not load workspace settings.",
            );
        });
    }
    return () => {
      cancelled = true;
    };
  }, [storageKey, liveSettings, retry]);
  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      setStorageError(
        "Changes could not be saved in this browser. Export your workspace before leaving.",
      );
    }
  }, [data, storageKey]);
  function update(
    action: string,
    target: string,
    recipe: (draft: AdminData) => void,
    detail = "Updated in the local frontend preview.",
  ) {
    setData((current) => {
      if (!current) return current;
      const draft = structuredClone(current);
      recipe(draft);
      draft.audit.unshift({
        id: uid(),
        date: now(),
        actor,
        action,
        target,
        detail,
      });
      return draft;
    });
  }
  const content = settingsError ? (
    <section className="admin-panel p-8">
      <h1>Unable to load workspace settings</h1>
      <p role="alert">{settingsError}</p>
      <button onClick={() => setRetry((value) => value + 1)}>Try again</button>
    </section>
  ) : !data ? (
    <WorkspaceLoading title="Opening MIRAI Admin" fullScreen={!Frame} />
  ) : (
    children
  );
  return (
    <Context.Provider
      value={{
        data: data ?? frameData,
        update,
        storageError,
        reset: () => setData(createAdminData()),
      }}
    >
      {Frame ? <Frame>{content}</Frame> : content}
    </Context.Provider>
  );
}
export function useAdmin() {
  const value = useContext(Context);
  if (!value) throw new Error("AdminProvider is required");
  return value;
}

// Files are kept in this browser's IndexedDB, never uploaded to a server.
function fileDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("mirai-admin-preview-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Local file storage is unavailable."));
  });
}
export async function savePreviewFile(file: File) {
  if (file.size > 20 * 1024 * 1024) throw new Error("Choose a file smaller than 20 MB.");
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Use PDF, JPG, PNG or WebP files.");
  const id = uid();
  const db = await fileDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("Could not save this file locally."));
    });
  } finally {
    db.close();
  }
  return { id, name: file.name, size: file.size, date: now() };
}
export async function readPreviewFile(id: string): Promise<Blob | undefined> {
  const db = await fileDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction("files").objectStore("files").get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error("Could not open the file."));
    });
  } finally {
    db.close();
  }
}
