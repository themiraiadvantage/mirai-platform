import { apiRequest } from "./api";
import { getAccessToken } from "./session";

export type BuyerOption = { id: string; name: string; email: string };
export type LiveAnnouncement = {
  id: string;
  title: string;
  body: string;
  audience: "ALL_BUYERS" | "SELECTED_BUYERS";
  buyerIds: string[];
  selectedBuyers: BuyerOption[];
  status: "DRAFT" | "PUBLISHED";
  author: { name: string };
  createdAt: string;
  publishedAt: string | null;
  recipientCount: number;
  readCount: number;
};
export type AnnouncementPage = {
  items: LiveAnnouncement[];
  nextCursor: string | null;
  stats: { drafts: number; published: number; delivered: number };
};
export type BuyerNotification = {
  id: string;
  createdAt: string;
  readAt: string | null;
  kind?: "announcement" | "activity";
  href?: string | null;
  announcement: { id: string; title: string; body: string; publishedAt: string };
};
export type NotificationPage = {
  items: BuyerNotification[];
  unreadCount: number;
  nextCursor: string | null;
};

export async function authenticatedRequest<T>(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  return apiRequest<T>(path, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
}

export function announcementDate(date: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(date));
}
