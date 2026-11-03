"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  MailCheck,
  ShieldCheck,
  Check,
  Circle,
  Send,
} from "lucide-react";
import { z } from "zod";
import { signIn, useSession } from "@/lib/session";
import { apiRequest, ApiError } from "@/lib/api";
import { authHref, workspaceDestination } from "@/lib/navigation";
import { PASSWORD_REQUIREMENTS } from "@/lib/password";
import { Logo } from "@/components/mirai/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(100, "Use at most 100 characters for your name"),
  email: z.string().trim().email("Enter a valid email address").max(254),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(128)
    .superRefine((value, context) => {
      for (const requirement of PASSWORD_REQUIREMENTS.slice(1)) {
        if (!requirement.test(value))
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Include ${requirement.label.toLowerCase()}`,
          });
      }
    }),
});
export default function Auth({ mode }: { mode: "sign-in" | "sign-up" | "forgot" | "verify" }) {
  const router = useRouter();
  const session = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"details" | "email" | "verified">(
    mode === "verify" ? "email" : "details",
  );
  const [verificationCode, setVerificationCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const creating = mode === "sign-up";
  const recovery = mode === "forgot";
  const [destination, setDestination] = useState("/dashboard");
  const [destinationReady, setDestinationReady] = useState(false);
  function currentDestination() {
    const query = new URLSearchParams(window.location.search).get("redirect");
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem("mirai-auth-redirect");
    } catch {
      /* Optional convenience. */
    }
    return workspaceDestination(query ?? stored);
  }
  useEffect(() => {
    setDestination(currentDestination());
    setDestinationReady(true);
  }, []);
  useEffect(() => {
    if (mode !== "verify") return;
    try {
      setEmail(sessionStorage.getItem("mirai-verification-email") || "");
    } catch {
      /* Email can also be entered manually. */
    }
  }, [mode]);

  function openVerification(address: string) {
    setEmail(address);
    setVerificationCode("");
    setStep("email");
    try {
      sessionStorage.setItem("mirai-verification-email", address);
      sessionStorage.setItem("mirai-auth-redirect", currentDestination());
    } catch {
      /* Optional convenience only. */
    }
    if (mode !== "verify") router.replace(authHref("/verify-email", currentDestination()));
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const address = email.trim().toLowerCase();
    if (!z.string().email().safeParse(address).success) {
      setError("Enter the email address you signed up with.");
      return;
    }
    if (!/^[0-9]{6}$/.test(verificationCode)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ email: address, code: verificationCode }),
      });
      setVerificationCode("");
      setStep("verified");
      try {
        sessionStorage.removeItem("mirai-verification-email");
      } catch {
        /* Optional convenience only. */
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (session && !recovery && destinationReady) {
      router.replace(destination);
      try {
        sessionStorage.removeItem("mirai-auth-redirect");
      } catch {
        /* Optional convenience. */
      }
    }
  }, [session, recovery, router, destination, destinationReady]);

  async function resend() {
    setError("");
    setNotice("");
    if (!z.string().email().safeParse(email.trim()).success) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      openVerification(email.trim().toLowerCase());
      setCooldown(60);
      setNotice(
        "If your account needs verification, a new code is on its way. Check your inbox and spam folder.",
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setNeedsVerification(false);
    const normalizedEmail = email.trim().toLowerCase();
    if (!z.string().email().safeParse(normalizedEmail).success) {
      setError("Enter a valid email address.");
      return;
    }
    if (creating) {
      const parsed = signupSchema.safeParse({ name, email: normalizedEmail, password });
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
      if (password !== confirmPassword) {
        setError("Your passwords do not match.");
        return;
      }
    }
    setBusy(true);
    try {
      if (creating) {
        await apiRequest("/auth/signup", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), email: normalizedEmail, password }),
        });
        setEmail(normalizedEmail);
        setPassword("");
        setConfirmPassword("");
        openVerification(normalizedEmail);
        setCooldown(60);
      } else {
        await signIn(normalizedEmail, password);
        const target = currentDestination();
        setDestination(target);
        router.replace(target);
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Something went wrong. Please try again.",
      );
      if (
        failure instanceof ApiError &&
        (failure.status === 403 || (creating && failure.status === 503))
      )
        setNeedsVerification(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main-content" className="auth-experience" data-mode={mode}>
      <aside className="auth-landscape marine-surface">
        <Image
          src="/images/mirai-coast-hero.webp"
          alt="Open tropical land with a sandy road and a distant coastal horizon"
          fill
          priority
          sizes="(min-width: 1024px) 46vw, 100vw"
          className="auth-landscape-photo"
        />
        <div className="auth-landscape-shade" />
        <div className="auth-brand-row">
          <Link href="/" aria-label="MIRAI home" className="text-white">
            <Logo />
          </Link>
          <Link href="/how-it-works" className="auth-about-link">
            The MIRAI way <ArrowRight size={14} />
          </Link>
        </div>
        <div className="auth-landscape-copy">
          <h2>
            A place for your
            <br />
            plans to <span className="text-brand-gold">grow.</span>
          </h2>
          <p className="auth-landscape-description">
            Explore the possibilities. Keep your land, documents, and next steps together in one
            clear record.
          </p>
          <div className="auth-proof-row">
            <ShieldCheck size={21} strokeWidth={1.4} />
            <div>
              <strong>Clarity at every step.</strong>
              <span>Your land. Your records. Your next chapter.</span>
            </div>
          </div>
        </div>
      </aside>
      <section className="auth-form-side">
        <div className="auth-topbar">
          <span className="auth-topbar-label">A more certain beginning</span>
          <Link
            href="/"
            className="ml-auto inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Back home
          </Link>
        </div>
        <div className="auth-card-wrap">
          <div className="auth-form-card">
            <div className="auth-form-icon" aria-hidden="true">
              {step === "email" ? (
                <MailCheck size={23} strokeWidth={1.5} />
              ) : step === "verified" ? (
                <ShieldCheck size={23} strokeWidth={1.5} />
              ) : (
                <Logo />
              )}
            </div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[.2em] text-gold">
              {step === "verified"
                ? "You are ready"
                : step === "email"
                  ? "One last step"
                  : recovery
                    ? "Account assistance"
                    : creating
                      ? "Make your next move"
                      : "Your MIRAI account"}
            </p>
            <h1 className="text-[clamp(2rem,3vw,2.75rem)] font-semibold leading-tight tracking-[-.04em]">
              {step === "verified"
                ? "Email verified."
                : step === "email"
                  ? "Check your inbox."
                  : recovery
                    ? "Let’s get you back."
                    : creating
                      ? "Start on solid ground."
                      : "Welcome back."}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {step === "verified"
                ? "Your MIRAI account is ready. Sign in to take your next step."
                : step === "email"
                  ? "Enter the 6-digit code sent to your email."
                  : recovery
                    ? "Need to verify your account? We can send a fresh code."
                    : creating
                      ? "Create an account to begin your land ownership journey."
                      : "Sign in to your land, your records, and your next step."}
            </p>

            {step === "verified" ? (
              <div className="mt-8 space-y-6">
                <div className="rounded-2xl border border-brand-gold/25 bg-brand-gold/5 p-6">
                  <ShieldCheck className="mb-4 size-10 text-gold" />
                  <p className="text-sm leading-7 text-muted-foreground">
                    Your email is confirmed. You can now sign in and open your workspace.
                  </p>
                </div>
                <Button asChild size="lg" className="w-full">
                  <Link href={authHref("/sign-in", destination)}>
                    Continue to sign in
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              </div>
            ) : step === "email" ? (
              <div className="mt-8 space-y-6">
                <div className="flex items-start gap-4 rounded-2xl border border-brand-gold/25 bg-brand-gold/5 p-5">
                  <MailCheck className="mt-1 size-6 shrink-0 text-gold" />
                  <p className="text-xs leading-6 text-muted-foreground">
                    {email ? (
                      <>
                        We’ve requested a code for{" "}
                        <strong className="break-words text-foreground">{email}</strong>.
                      </>
                    ) : (
                      "Use the email address you signed up with."
                    )}{" "}
                    Your code expires in 10 minutes. Check your spam folder if it is missing.
                  </p>
                </div>
                <form onSubmit={verifyCode} className="space-y-5" aria-busy={busy}>
                  {mode === "verify" && (
                    <div className="space-y-2">
                      <Label htmlFor="verification-email">Email address</Label>
                      <Input
                        id="verification-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setVerificationCode("");
                          setError("");
                        }}
                        placeholder="you@example.com"
                        disabled={busy}
                        className="h-12"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="verification-code">Verification code</Label>
                    <Input
                      id="verification-code"
                      name="code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      minLength={6}
                      maxLength={6}
                      required
                      value={verificationCode}
                      onChange={(event) =>
                        setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      disabled={busy}
                      placeholder="000000"
                      aria-describedby="verification-code-help"
                      className="h-16 text-center font-mono text-2xl tracking-[.4em]"
                    />
                    <p
                      id="verification-code-help"
                      className="text-xs leading-5 text-muted-foreground"
                    >
                      Enter all 6 digits. Never share this code.
                    </p>
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : null}
                    {busy ? "Verifying…" : "Verify email"}
                    {!busy && <ArrowRight size={16} />}
                  </Button>
                </form>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Didn’t receive a code?</p>
                  <button
                    type="button"
                    onClick={resend}
                    disabled={busy || cooldown > 0}
                    className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-foreground underline underline-offset-4 disabled:text-muted-foreground disabled:no-underline"
                  >
                    {busy && <Loader2 size={13} className="animate-spin" />}
                    {cooldown > 0 ? `Resend email in ${cooldown}s` : "Send a new code"}
                  </button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Already verified?{" "}
                  <Link
                    href={authHref("/sign-in", destination)}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            ) : recovery ? (
              <div className="mt-8 space-y-5">
                <p className="rounded-xl border border-border bg-overlay/40 p-4 text-xs leading-6 text-muted-foreground">
                  Password reset is not available yet. If you have not confirmed your email, request
                  a new verification code below.
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void resend();
                  }}
                  className="space-y-4"
                >
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="h-12"
                  />
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <Send />}Send verification code
                  </Button>
                </form>
                <Link
                  href={authHref("/sign-in", destination)}
                  className="inline-flex min-h-11 items-center gap-2 text-xs"
                >
                  <ArrowLeft size={14} />
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-8 space-y-5" aria-busy={busy}>
                <fieldset disabled={busy} className="space-y-5 disabled:opacity-75">
                  <legend className="sr-only">
                    {creating ? "Create your MIRAI account" : "Sign in to MIRAI"}
                  </legend>
                  {creating && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Full name</Label>
                      <Input
                        id="name"
                        name="name"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={100}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Your full name"
                        className="h-12 bg-white"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="h-12 bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="password">Password</Label>
                      {!creating && (
                        <Link
                          href={authHref("/forgot-password", destination)}
                          className="auth-forgot-link"
                        >
                          Forgot password?
                        </Link>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={creating ? "new-password" : "current-password"}
                        required
                        minLength={creating ? 8 : 1}
                        maxLength={128}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={creating ? "Create a strong password" : "Enter your password"}
                        aria-describedby={creating ? "password-help" : undefined}
                        className="h-12 bg-white pr-12"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand-gold"
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    {creating && (
                      <ul
                        id="password-help"
                        aria-label="Password requirements"
                        aria-live="polite"
                        className="grid grid-cols-1 gap-x-3 gap-y-1.5 pt-1 text-xs leading-5 min-[360px]:grid-cols-2"
                      >
                        {PASSWORD_REQUIREMENTS.map((requirement) => {
                          const met = requirement.test(password);
                          const Icon = met ? Check : Circle;
                          return (
                            <li
                              key={requirement.label}
                              className={`flex items-start gap-1.5 transition-colors ${met ? "text-marine-deep" : "text-muted-foreground"}`}
                            >
                              <Icon
                                aria-hidden="true"
                                className={`mt-0.5 size-3.5 shrink-0 ${met ? "text-gold" : "opacity-40"}`}
                              />
                              <span>
                                <span className="sr-only">{met ? "Met: " : "Needed: "}</span>
                                {requirement.label}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {creating && (
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm password</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          required
                          maxLength={128}
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Re-enter your password"
                          aria-describedby="confirm-password-help"
                          aria-invalid={confirmPassword.length > 0 && confirmPassword !== password}
                          className="h-12 bg-white pr-12"
                        />
                        <button
                          type="button"
                          aria-label={
                            showConfirmPassword
                              ? "Hide confirmed password"
                              : "Show confirmed password"
                          }
                          aria-pressed={showConfirmPassword}
                          onClick={() => setShowConfirmPassword((value) => !value)}
                          className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand-gold"
                        >
                          {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                      <p
                        id="confirm-password-help"
                        aria-live="polite"
                        className={`flex items-center gap-1.5 text-xs leading-5 ${confirmPassword ? (confirmPassword === password ? "text-marine-deep" : "text-destructive") : "text-muted-foreground"}`}
                      >
                        {confirmPassword && confirmPassword === password && (
                          <Check aria-hidden="true" className="size-3.5 text-gold" />
                        )}
                        {confirmPassword
                          ? confirmPassword === password
                            ? "Passwords match"
                            : "Passwords do not match"
                          : "Re-enter your password to confirm."}
                      </p>
                    </div>
                  )}
                  {creating && (
                    <label className="flex items-start gap-3 text-xs leading-6 text-muted-foreground">
                      <input
                        name="terms"
                        type="checkbox"
                        required
                        className="mt-1.5 size-4 shrink-0 accent-[#00101A]"
                      />
                      <span>
                        I agree to the{" "}
                        <Link
                          href="/terms"
                          className="font-medium text-foreground underline underline-offset-2"
                        >
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link
                          href="/privacy"
                          className="font-medium text-foreground underline underline-offset-2"
                        >
                          Privacy Notice
                        </Link>
                        .
                      </span>
                    </label>
                  )}
                </fieldset>
                {error && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs leading-6 text-destructive"
                  >
                    {error}
                  </p>
                )}
                {needsVerification && (
                  <button
                    type="button"
                    onClick={resend}
                    disabled={busy || cooldown > 0}
                    className="min-h-11 text-xs font-medium underline underline-offset-4 disabled:opacity-50"
                  >
                    Resend verification email
                  </button>
                )}
                <Button type="submit" size="lg" className="h-12 w-full" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : null}
                  {busy
                    ? creating
                      ? "Creating your account…"
                      : "Signing in…"
                    : creating
                      ? "Create account"
                      : "Sign in"}
                </Button>
              </form>
            )}
            {(step === "email" || recovery) && error && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs leading-6 text-destructive"
              >
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="mt-4 text-xs leading-6 text-muted-foreground">
                {notice}
              </p>
            )}
            {step === "details" && !recovery && (
              <p className="mt-7 text-center text-sm text-muted-foreground">
                {creating ? "Already have an account? " : "New to MIRAI? "}
                <Link
                  href={authHref(creating ? "/sign-in" : "/sign-up", destination)}
                  className="font-semibold text-foreground underline decoration-brand-gold underline-offset-4"
                >
                  {creating ? "Sign in" : "Create an account"}
                </Link>
              </p>
            )}
          </div>
        </div>
        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} MIRAI</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </div>
        </footer>
      </section>
    </main>
  );
}
