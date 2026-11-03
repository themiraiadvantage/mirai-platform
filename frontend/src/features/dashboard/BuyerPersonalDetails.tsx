"use client";
import Link from "next/link";
import { useState } from "react";
import { useSession, updateSession, type BuyerRole } from "@/lib/session";
import { post, usePropertyResource } from "@/lib/property-api";
import type { BuyerContact } from "@/lib/buyer-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
export function BuyerPersonalDetails() {
  const session = useSession();
  const r = usePropertyResource<BuyerContact>("/profile", true, !!session && !session.staffRole);
  if (session?.staffRole)
    return (
      <section className="surface p-6">
        <h2 className="text-2xl">Staff profile</h2>
        <Button className="mt-5" variant="outline" asChild>
          <Link href="/admin/settings">Open admin profile</Link>
        </Button>
      </section>
    );
  if (r.error)
    return (
      <section className="surface p-6">
        <p role="alert">{r.error}</p>
        <Button className="mt-4" variant="outline" onClick={r.refresh}>
          Try again
        </Button>
      </section>
    );
  if (!r.data)
    return (
      <section role="status" className="surface animate-pulse p-8">
        Loading your profile…
      </section>
    );
  return (
    <ProfileForm
      key={r.data.id + ":" + r.data.version}
      profile={r.data}
      role={session?.role || "buyer"}
      refresh={r.refresh}
    />
  );
}
function ProfileForm({
  profile,
  role: initialRole,
  refresh,
}: {
  profile: BuyerContact;
  role: BuyerRole;
  refresh: () => void;
}) {
  const [form, setForm] = useState({
    name: profile.name,
    phone: profile.phone,
    location: profile.location,
  });
  const [role, setRole] = useState(initialRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await post<BuyerContact>("/profile", { ...form, version: profile.version });
      updateSession({ name: saved.name, phone: saved.phone, role });
      toast.success("Profile updated");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update profile.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="surface space-y-5 p-6" onSubmit={(e) => void save(e)}>
      <h2 className="text-2xl">Personal details</h2>
      <div className="space-y-2">
        <Label htmlFor="profile-name">Full name</Label>
        <Input
          id="profile-name"
          required
          minLength={2}
          maxLength={160}
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" value={profile.email} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-phone">Phone number</Label>
        <Input
          id="profile-phone"
          type="tel"
          maxLength={30}
          placeholder="+234 801 234 5678"
          value={form.phone}
          onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-location">Location</Label>
        <Input
          id="profile-location"
          maxLength={160}
          placeholder="City and state"
          value={form.location}
          onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-role">I’m here as</Label>
        <select
          id="profile-role"
          className="filter-select w-full"
          value={role}
          onChange={(e) => setRole(e.target.value as BuyerRole)}
        >
          <option value="buyer">A land buyer</option>
          <option value="partner">A co-ownership buyer</option>
          <option value="developer">An estate developer</option>
        </select>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
