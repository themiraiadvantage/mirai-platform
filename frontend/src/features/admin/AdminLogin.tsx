"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/mirai/primitives";
import { apiRequest } from "@/lib/api";
import { signIn, useSession } from "@/lib/session";
import { PASSWORD_REQUIREMENTS } from "@/lib/password";
import { adminDestination, adminRequest, STAFF_ROLES, type AdminAccess } from "./admin-auth";

function Frame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="admin-auth-page">
      <section className="admin-auth-card">
        <Link href="/" className="admin-auth-logo">
          <Logo />
        </Link>
        <p className="admin-auth-eyebrow">MIRAI ADMIN</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </section>
    </main>
  );
}
function PasswordField({
  label = "Password",
  value,
  onChange,
  autoComplete = "current-password",
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="admin-auth-field">
      {label}
      <span className="admin-auth-password">
        <input
          required
          minLength={autoComplete === "new-password" ? 8 : 1}
          maxLength={128}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={() => setVisible((x) => !x)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}
export function AdminLogin() {
  const router = useRouter();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const destination = () =>
    adminDestination(new URLSearchParams(window.location.search).get("redirect"));
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    adminRequest<AdminAccess>("/me")
      .then(() => {
        if (!cancelled)
          router.replace(
            adminDestination(new URLSearchParams(window.location.search).get("redirect")),
          );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session, router]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password, true);
      await adminRequest<AdminAccess>("/me");
      router.replace(destination());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Frame title="Welcome back." description="Sign in to manage your MIRAI workspace.">
      <form onSubmit={submit}>
        <label className="admin-auth-field">
          Admin email
          <input
            required
            type="email"
            autoComplete="username"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <PasswordField value={password} onChange={setPassword} />
        {error && (
          <p role="alert" className="admin-auth-error">
            {error}
          </p>
        )}
        <button className="admin-auth-submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </Frame>
  );
}
export function AdminSetPassword() {
  const [token, setToken] = useState("");
  const [invitation, setInvitation] = useState<{
    name: string;
    email: string;
    role: keyof typeof STAFF_ROLES;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    if (!/^[a-f0-9]{64}$/.test(value)) {
      setError(
        "Open the password setup link from your invitation email. Ask the platform owner for a new link if it has expired.",
      );
      return;
    }
    setToken(value);
    let cancelled = false;
    apiRequest<{ name: string; email: string; role: keyof typeof STAFF_ROLES }>(
      "/auth/admin/invitation",
      { method: "POST", body: JSON.stringify({ token: value }) },
    )
      .then((data) => {
        if (!cancelled) setInvitation(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!PASSWORD_REQUIREMENTS.every((rule) => rule.test(password))) {
      setError("Your password must meet all the requirements below.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/auth/admin/accept-invitation", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      setPassword("");
      setConfirm("");
      setToken("");
      window.history.replaceState(null, "", window.location.pathname);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set your password.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Frame
      title={done ? "Your account is ready." : "Set your password."}
      description={
        done
          ? "Your admin access is active. Sign in with your email and the password you just chose."
          : "Choose a private password to activate your admin account."
      }
    >
      {done ? (
        <Link className="admin-auth-submit" href="/admin/login">
          Continue to admin sign in
        </Link>
      ) : (
        <>
          {!invitation && !error && <p role="status">Checking your invitation…</p>}
          {invitation && (
            <>
              <div className="admin-invitation-summary">
                <strong>{invitation.name}</strong>
                <span>{invitation.email}</span>
                <small>{STAFF_ROLES[invitation.role]}</small>
              </div>
              <form onSubmit={submit}>
                <input
                  type="text"
                  autoComplete="username"
                  value={invitation.email}
                  readOnly
                  hidden
                />
                <PasswordField
                  label="New password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                />
                <ul className="admin-password-rules">
                  {PASSWORD_REQUIREMENTS.map((rule) => (
                    <li key={rule.label} className={rule.test(password) ? "met" : ""}>
                      {rule.test(password) ? "✓ " : "○ "}
                      {rule.label}
                    </li>
                  ))}
                </ul>
                <PasswordField
                  label="Confirm password"
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                />
                <button className="admin-auth-submit" disabled={busy}>
                  {busy ? "Setting your password…" : "Set password and activate account"}
                </button>
              </form>
            </>
          )}
          {error && (
            <p role="alert" className="admin-auth-error">
              {error}
            </p>
          )}
          <Link className="admin-auth-back" href="/admin/login">
            Back to admin sign in
          </Link>
        </>
      )}
    </Frame>
  );
}
