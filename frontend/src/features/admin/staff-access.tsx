"use client";
import { STAFF_ROLES } from "./admin-auth";
import { Field } from "./admin-ui";

export const ACCESS_SECTIONS = {
  dashboard: "Overview",
  plots: "Plots",
  documents: "Documents",
  customers: "Buyers",
  reservations: "Reservations",
  payments: "Payments",
  "site-checks": "Site checks",
  "co-ownership": "Co-ownership",
  announcements: "Announcements",
  audit: "Activity history",
  settings: "Settings",
  catalogue: "Catalogue preview",
};
export type StaffRole = keyof typeof STAFF_ROLES;
export type StaffAccessValue = { role: StaffRole; permissions: string[] };
export const ACCESS_PRESETS: Record<StaffRole, string[]> = {
  SUPER_ADMIN: [...Object.keys(ACCESS_SECTIONS), "staff"],
  ADMIN: [...Object.keys(ACCESS_SECTIONS)],
  LISTING_MANAGER: ["dashboard", "plots", "documents", "catalogue"],
  VERIFICATION_REVIEWER: ["dashboard", "documents"],
  PAYMENT_SUPPORT: ["dashboard", "payments", "reservations", "customers"],
  DOCUMENT_ADMINISTRATOR: ["dashboard", "documents"],
  SITE_CHECK_CONTRIBUTOR: ["dashboard", "site-checks"],
};
export function selectedAccess(role: StaffRole, permissions?: string[]) {
  return role === "SUPER_ADMIN" || !permissions?.length ? [...ACCESS_PRESETS[role]] : permissions;
}
export function accessDescription(role: StaffRole, permissions?: string[]) {
  if (role === "SUPER_ADMIN") return "Full access, including staff management";
  const selected = selectedAccess(role, permissions);
  if (Object.keys(ACCESS_SECTIONS).every((key) => selected.includes(key)))
    return "All operational sections";
  return (
    selected
      .filter((key) => key !== "dashboard")
      .map((key) => ACCESS_SECTIONS[key as keyof typeof ACCESS_SECTIONS])
      .filter(Boolean)
      .join(", ") || "Overview only"
  );
}
export function StaffAccessPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: StaffAccessValue;
  onChange: (value: StaffAccessValue) => void;
  disabled?: boolean;
}) {
  const superAdmin = value.role === "SUPER_ADMIN";
  const selected = selectedAccess(value.role, value.permissions);
  return (
    <div className="admin-access-picker">
      <Field
        label="Role template"
        hint="Choose a starting point, then customise the sections below."
      >
        <select
          disabled={disabled}
          value={value.role}
          onChange={(e) => {
            const role = e.target.value as StaffRole;
            onChange({
              role,
              permissions: role === "SUPER_ADMIN" ? [] : [...ACCESS_PRESETS[role]],
            });
          }}
        >
          {Object.entries(STAFF_ROLES).map(([role, label]) => (
            <option key={role} value={role}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {superAdmin ? (
        <p className="admin-access-note">
          Super Admins have full platform access, including inviting admins and managing staff
          permissions.
        </p>
      ) : (
        <fieldset disabled={disabled} className="admin-access-fieldset">
          <legend>Allowed sections</legend>
          <div className="admin-access-actions">
            <button
              type="button"
              onClick={() => onChange({ ...value, permissions: Object.keys(ACCESS_SECTIONS) })}
            >
              Select all sections
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...value, permissions: ["dashboard"] })}
            >
              Clear selection
            </button>
          </div>
          <div className="admin-access-grid">
            {Object.entries(ACCESS_SECTIONS).map(([key, label]) => (
              <label key={key} className="admin-access-option">
                <input
                  type="checkbox"
                  checked={selected.includes(key)}
                  disabled={key === "dashboard"}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      permissions: e.target.checked
                        ? [...new Set([...selected, key])]
                        : selected.filter((item) => item !== key),
                    })
                  }
                />
                <span>
                  {label}
                  {key === "dashboard" && <small>Always included</small>}
                </span>
              </label>
            ))}
          </div>
          <p className="admin-access-note">
            All operational access excludes staff management. Choose Super Admin to grant that
            authority.
          </p>
        </fieldset>
      )}
    </div>
  );
}
