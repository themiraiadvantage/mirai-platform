"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PageHead, Panel, Field, Badge, Modal } from "./admin-ui";
import { adminRequest, STAFF_ROLES, useAdminAccess } from "./admin-auth";
import {
  StaffAccessPicker,
  selectedAccess,
  accessDescription,
  ACCESS_PRESETS,
  type StaffAccessValue,
} from "./staff-access";

type Member = {
  id: string;
  name: string;
  email: string;
  staffRole: keyof typeof STAFF_ROLES;
  staffActive: boolean;
  staffPermissions: string[];
};
type Invitation = {
  id: string;
  name: string;
  email: string;
  role: keyof typeof STAFF_ROLES;
  expiresAt: string;
  createdAt: string;
  permissions: string[];
};
type StaffData = { members: Member[]; invitations: Invitation[] };
export function AdminStaffAccess() {
  const access = useAdminAccess();
  const [data, setData] = useState<StaffData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<Member | null>(null);
  const [invite, setInvite] = useState({
    name: "",
    email: "",
  });
  const [editing, setEditing] = useState<Member | null>(null);
  const [permissions, setPermissions] = useState<StaffAccessValue>({
    role: "LISTING_MANAGER",
    permissions: [...ACCESS_PRESETS.LISTING_MANAGER],
  });
  async function load() {
    setData(await adminRequest<StaffData>("/staff"));
  }
  useEffect(() => {
    let cancelled = false;
    adminRequest<StaffData>("/staff")
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function send(input: {
    name: string;
    email: string;
    role?: keyof typeof STAFF_ROLES;
    permissions?: string[];
  }) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await adminRequest<{ message: string }>("/invitations", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setNotice(result.message);
      setOpen(false);
      setInvite({
        name: "",
        email: "",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send invitation.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    await send(invite);
  }
  async function changeAccess() {
    if (!target) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await adminRequest<{ message: string }>(`/staff/${target.id}/access`, {
        method: "POST",
        body: JSON.stringify({ active: !target.staffActive }),
      });
      setNotice(result.message);
      setTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update access.");
    } finally {
      setBusy(false);
    }
  }
  async function savePermissions(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await adminRequest<{ message: string }>(`/staff/${editing.id}/permissions`, {
        method: "POST",
        body: JSON.stringify(permissions),
      });
      setNotice(result.message);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update permissions.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        title="Staff & access"
        description="Invite your team, assign their responsibilities and manage access to MIRAI Admin."
        action={<Button onClick={() => setOpen(true)}>Invite admin</Button>}
      />
      {error && (
        <p role="alert" className="admin-storage-warning">
          {error}{" "}
          <button
            onClick={() => {
              setError("");
              void load().catch((e) => setError(e.message));
            }}
          >
            Refresh
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="admin-storage-warning">
          {notice}
        </p>
      )}
      <Panel
        title="Your team"
        description="These accounts and invitations are saved to the MIRAI database."
      >
        {!data ? (
          <div className="admin-panel-body" role="status">
            Loading staff accounts…
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Team member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.name}</strong>
                      <small>{member.email}</small>
                    </td>
                    <td>
                      <strong>{STAFF_ROLES[member.staffRole]}</strong>
                      <small className="admin-access-summary">
                        {accessDescription(member.staffRole, member.staffPermissions)}
                      </small>
                    </td>
                    <td>
                      <Badge>{member.staffActive ? "Active" : "Suspended"}</Badge>
                    </td>
                    <td>
                      {member.id === access.user.id ? (
                        <span className="text-xs text-muted-foreground">Your account</span>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              setError("");
                              setEditing(member);
                              setPermissions({
                                role: member.staffRole,
                                permissions: selectedAccess(
                                  member.staffRole,
                                  member.staffPermissions,
                                ).filter((key) => key !== "staff"),
                              });
                            }}
                          >
                            Edit permissions
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => setTarget(member)}
                          >
                            {member.staffActive ? "Suspend access" : "Restore access"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel
        title="Pending invitations"
        description="Links expire after 24 hours. Resending an invitation replaces the previous link."
      >
        {data?.invitations.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.invitations.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>{item.email}</small>
                    </td>
                    <td>
                      <strong>{STAFF_ROLES[item.role]}</strong>
                      <small className="admin-access-summary">
                        {accessDescription(item.role, item.permissions)}
                      </small>
                    </td>
                    <td>
                      <Badge>
                        {new Date(item.expiresAt).getTime() > Date.now() ? "Pending" : "Expired"}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void send({
                            name: item.name,
                            email: item.email,
                            role: item.role,
                            permissions: item.permissions,
                          })
                        }
                      >
                        Resend invitation
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-panel-body text-sm text-muted-foreground">
            {data
              ? "No pending invitations. Invite an admin when you’re ready to add your team."
              : "Loading invitations…"}
          </p>
        )}
      </Panel>
      <Modal
        title="Invite an admin"
        description="They will receive an email to set their own password. Access starts only after they accept."
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <form className="admin-form" onSubmit={submit}>
          <Field label="Full name">
            <input
              required
              minLength={2}
              maxLength={100}
              value={invite.name}
              onChange={(e) => setInvite({ ...invite, name: e.target.value })}
            />
          </Field>
          <Field label="Email address">
            <input
              required
              type="email"
              maxLength={254}
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <Button disabled={busy}>{busy ? "Sending invitation…" : "Send invitation"}</Button>
        </form>
      </Modal>
      <Modal
        title="Edit admin permissions"
        description={
          editing
            ? `Manage access for ${editing.name}. Changes apply on their next access check.`
            : "Update access sections."
        }
        open={!!editing}
        onClose={() => {
          if (!busy) setEditing(null);
        }}
      >
        <form className="admin-form" onSubmit={savePermissions}>
          <StaffAccessPicker value={permissions} onChange={setPermissions} disabled={busy} />
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <Button disabled={busy}>{busy ? "Saving…" : "Save permissions"}</Button>
        </form>
      </Modal>
      <Modal
        title={target?.staffActive ? "Suspend admin access?" : "Restore admin access?"}
        description={
          target?.staffActive
            ? "Their active sessions will be signed out. You can restore access later."
            : "This person will be able to sign in with their existing password."
        }
        open={!!target}
        onClose={() => {
          if (!busy) setTarget(null);
        }}
      >
        <p className="text-sm">{target?.email}</p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button disabled={busy} onClick={changeAccess}>
          {busy ? "Saving…" : "Confirm"}
        </Button>
      </Modal>
    </>
  );
}
