import type { StaffRole } from "../generated/prisma/enums";

export const STAFF_SECTIONS = [
  "dashboard",
  "plots",
  "documents",
  "customers",
  "reservations",
  "payments",
  "site-checks",
  "co-ownership",
  "announcements",
  "audit",
  "settings",
  "catalogue",
] as const;
export const staffPermissions: Record<StaffRole, readonly string[]> = {
  SUPER_ADMIN: [...STAFF_SECTIONS, "staff"],
  ADMIN: [...STAFF_SECTIONS],
  LISTING_MANAGER: ["dashboard", "plots", "documents", "catalogue"],
  VERIFICATION_REVIEWER: ["dashboard", "documents"],
  PAYMENT_SUPPORT: ["dashboard", "payments", "reservations", "customers"],
  DOCUMENT_ADMINISTRATOR: ["dashboard", "documents"],
  SITE_CHECK_CONTRIBUTOR: ["dashboard", "site-checks"],
};

export function resolveStaffPermissions(user: {
  staffRole: StaffRole | null;
  staffActive: boolean;
  staffPermissions: string[];
}) {
  if (!user.staffActive || !user.staffRole) return [];
  if (user.staffRole === "SUPER_ADMIN") return [...staffPermissions.SUPER_ADMIN];
  const selected = user.staffPermissions.length
    ? user.staffPermissions
    : staffPermissions[user.staffRole];
  return [
    "dashboard",
    ...STAFF_SECTIONS.filter((key) => key !== "dashboard" && selected.includes(key)),
  ];
}
