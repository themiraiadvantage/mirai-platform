"use client";

import Link from "next/link";
import { useState } from "react";
import { adminRequest, useAdminAccess } from "./admin-auth";
import { Plus, ArrowUpRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PERMISSIONS, type StaffRole } from "@/lib/data";
import { useAdmin, uid, dateLabel, type StaffMember } from "./admin-store";
import { PageHead, Panel, Badge, SearchBox, Empty, Modal, Field } from "./admin-ui";

export { AdminAnnouncements } from "./AdminAnnouncements";

export function AdminStaff() {
  const { data, update } = useAdmin();
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [q, setQ] = useState("");
  const list = data.staff.filter((s) =>
    (s.name + s.role + s.email).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Staff & access"
        description="Give each team member the access they need to do their work."
        action={
          <Button
            onClick={() =>
              setEditing({ id: uid(), name: "", email: "", role: "Listing Manager", active: true })
            }
          >
            <Plus size={16} />
            Add staff record
          </Button>
        }
      />
      <div className="admin-toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search staff name, email or role…" />
        <span className="admin-record-count">
          {data.staff.filter((s) => s.active).length} active staff
        </span>
      </div>
      <Panel>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Team member</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="admin-person-cell">
                      <span>
                        {s.name
                          .split(" ")
                          .map((v) => v[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div>
                        <strong>{s.name}</strong>
                        <small>{s.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{s.role}</td>
                  <td>
                    <Badge>{s.active ? "Active" : "Suspended"}</Badge>
                  </td>
                  <td>
                    <button className="admin-text-link" onClick={() => setEditing(s)}>
                      Manage access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length && <Empty />}
      </Panel>
      <Panel
        title="Role responsibilities"
        description="A preview of the intended access model. Real permissions will be enforced by the backend."
        className="mt-6"
      >
        <div className="admin-role-grid">
          {[
            ["Super Admin", "Full workspace access, staff permissions and operational oversight."],
            [
              "Listing Manager",
              "Create and maintain plot listings, pricing, photos and publication.",
            ],
            [
              "Verification Reviewer",
              "Review document evidence, record decisions and follow-up actions.",
            ],
            [
              "Payment Support",
              "Review payment records, reconciliation and buyer payment queries.",
            ],
            ["Document Administrator", "Manage uploads, versions and document access."],
            [
              "Site Check Contributor",
              "Prepare sourced site findings, inspections and specialist follow-up.",
            ],
          ].map(([name, copy]) => (
            <div key={name}>
              <ShieldCheck size={18} />
              <h3>{name}</h3>
              <p>{copy}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Modal
        title="Staff access"
        description="Creates a local sample record. No invitation, password or real account access is created."
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing.name.trim()) return;
              if (
                data.staff.some(
                  (s) =>
                    s.email.toLowerCase() === editing.email.trim().toLowerCase() &&
                    s.id !== editing.id,
                )
              ) {
                toast.error("This email already has a staff record.");
                return;
              }
              const previous = data.staff.find((s) => s.id === editing.id);
              if (
                previous?.role === "Super Admin" &&
                previous.active &&
                (!editing.active || editing.role !== "Super Admin") &&
                data.staff.filter((s) => s.active && s.role === "Super Admin").length === 1
              ) {
                toast.error("Keep at least one active Super Admin in the preview.");
                return;
              }
              update(
                "Staff access updated",
                editing.name,
                (s) => {
                  const index = s.staff.findIndex((v) => v.id === editing.id);
                  const value = {
                    ...editing,
                    email: editing.email.trim().toLowerCase(),
                    name: editing.name.trim(),
                  };
                  if (index < 0) s.staff.push(value);
                  else s.staff[index] = value;
                },
                `${editing.role} · ${editing.active ? "Active" : "Suspended"}`,
              );
              setEditing(null);
              toast.success("Preview staff record saved");
            }}
          >
            <Field label="Full name">
              <input
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                value={editing.email}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <select
                value={editing.role}
                onChange={(e) => setEditing({ ...editing, role: e.target.value as StaffRole })}
              >
                {Object.keys(PERMISSIONS).map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </Field>
            <Field label="Access status">
              <select
                value={editing.active ? "Active" : "Suspended"}
                onChange={(e) => setEditing({ ...editing, active: e.target.value === "Active" })}
              >
                <option>Active</option>
                <option>Suspended</option>
              </select>
            </Field>
            <Button>Save staff record</Button>
          </form>
        )}
      </Modal>
    </>
  );
}

export { AdminActivity as AdminAudit } from "./AdminActivity";

export function AdminSettings() {
  const { data, update } = useAdmin();
  const access = useAdminAccess();
  const isOwner = access.user.staffRole === "SUPER_ADMIN";
  const [settings, setSettings] = useState(data.settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await adminRequest<typeof settings>("/settings", {
        method: "POST",
        body: JSON.stringify({
          company: settings.company,
          email: settings.email,
          phone: settings.phone,
          ...(isOwner
            ? { reservationFee: settings.reservationFee, accessMonths: settings.accessMonths }
            : {}),
        }),
      });
      setSettings(saved);
      update(
        "Workspace settings saved",
        saved.company,
        (draft) => {
          draft.settings = saved;
        },
        "Saved to the MIRAI database.",
      );
      toast.success("Settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        title="Workspace settings"
        description="Manage your company profile and listing defaults."
      />
      <Panel
        title="Company profile"
        description="Saved securely to MIRAI and shared across your admin team."
      >
        <form className="admin-panel-body admin-form" onSubmit={save}>
          <fieldset disabled={busy} className="admin-form border-0 p-0 m-0 min-w-0">
            <Field label="Company name">
              <input
                required
                maxLength={100}
                value={settings.company}
                onChange={(e) => setSettings({ ...settings, company: e.target.value })}
              />
            </Field>
            <Field label="Support email">
              <input
                required
                type="email"
                maxLength={254}
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              />
            </Field>
            <Field label="Support phone">
              <input
                type="tel"
                maxLength={40}
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </Field>
            <div className="admin-form-grid">
              <Field label="Default reservation fee (₦)">
                <input
                  type="number"
                  required
                  min="0"
                  max="2147483647"
                  step="1"
                  readOnly={!isOwner}
                  aria-readonly={!isOwner}
                  value={settings.reservationFee}
                  onChange={(e) =>
                    setSettings({ ...settings, reservationFee: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Default access (months)">
                <input
                  type="number"
                  required
                  min="1"
                  max="120"
                  step="1"
                  readOnly={!isOwner}
                  aria-readonly={!isOwner}
                  value={settings.accessMonths}
                  onChange={(e) =>
                    setSettings({ ...settings, accessMonths: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <p className="text-sm text-muted-foreground">
              {isOwner
                ? "Defaults apply to new plots. Existing listings and buyer agreements stay unchanged."
                : "Only the Super Admin can change the default reservation fee and access duration."}
            </p>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <Button className="self-start" disabled={busy}>
              {busy ? "Saving…" : "Save settings"}
            </Button>
          </fieldset>
        </form>
      </Panel>
    </>
  );
}

export function AdminChecks() {
  const { data } = useAdmin();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const plots = data.plots.filter(
    (p) =>
      (!status || p.siteStatus === status) &&
      (p.code + p.location).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Location & site checks"
        description="Review sourced findings, inspection status and the next action for each plot."
      />
      <div className="admin-toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search plot code or location…" />
        <select
          aria-label="Assessment status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {[
            "Not yet checked",
            "Desk check complete",
            "Specialist visit recommended",
            "Site visit complete",
            "Information needs updating",
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <span className="admin-record-count">{plots.length} records</span>
      </div>
      <div className="admin-site-grid">
        {plots.map((p) => (
          <Panel key={p.code}>
            <div className="admin-panel-body">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold text-gold">{p.code}</span>
                <Badge>{p.siteStatus}</Badge>
              </div>
              <h2 className="mt-4 text-lg font-semibold">
                {p.location}, {p.state}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {p.checks.filter((c) => c.result === "further").length} findings need follow-up ·{" "}
                {p.checks.filter((c) => c.result === "nodata").length} lack evidence
              </p>
              <div className="admin-site-summary">
                <span>
                  Reviewer<strong>{p.siteReviewer || "Not assigned"}</strong>
                </span>
                <span>
                  Method<strong>{p.siteMethod || "Not recorded"}</strong>
                </span>
              </div>
              <p className="mb-5 text-xs leading-6 text-muted-foreground">
                Next action:{" "}
                {p.siteNextAction ||
                  "Review evidence, assign a reviewer and record any specialist follow-up."}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/plots/${p.code}?section=${encodeURIComponent("Site checks")}`}>
                  Manage assessment <ArrowUpRight size={13} />
                </Link>
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
