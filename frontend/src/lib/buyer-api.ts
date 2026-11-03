export type BuyerContact = {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  joinedAt: string;
  phone: string;
  location: string;
  version: number;
  notes?: string;
};
export type BuyerAccess = {
  payments: boolean;
  documents: boolean;
  reservations: boolean;
  coOwnership: boolean;
  plots: boolean;
};
export type BuyerRow = BuyerContact & {
  activeReservations: number;
  partnerships: number;
  allocations: number;
  confirmed: number | null;
};
export type BuyerPage = {
  items: BuyerRow[];
  total: number;
  nextCursor: string | null;
  stats: { registered: number; verified: number; reserved: number; allocated: number };
  access: BuyerAccess;
};
export type BuyerDetail = BuyerContact & {
  activeReservations: number;
  partnerships: number;
  allocations: number;
  confirmedFees: number | null;
  confirmedContributions: number | null;
  documents: number | null;
  access: BuyerAccess;
};
export type BuyerSection =
  "reservations" | "payments" | "contributions" | "co-ownership" | "documents";
export type BuyerRecordsPage = {
  items: {
    id: string;
    name?: string;
    category?: string;
    fileVersion?: number;
    plot: { code: string; title: string; location: string; state: string; size: number };
    status: string;
    date: string;
    amount: number | null;
    accessExpiresAt?: string | null;
  }[];
  total: number;
  nextCursor: string | null;
};
