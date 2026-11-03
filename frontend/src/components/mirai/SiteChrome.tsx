"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "./primitives";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { COMPANY } from "@/lib/company";

const links = [
  { to: "/plots", label: "Plots" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/site-checks", label: "Site checks" },
  { to: "/co-own", label: "Co-own" },
  { to: "/fees", label: "Fees" },
  { to: "/faq", label: "FAQ" },
] as const;

export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const f = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      setP(h > 0 ? scrollY / h : 0);
    };
    f();
    addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, []);
  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-brand-gold"
      style={{ transform: `scaleX(${p})` }}
    />
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const session = useSession();
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = previous;
    };
  }, [open]);
  useEffect(() => {
    const f = () => setScrolled(scrollY > 20);
    f();
    addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, []);
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/95 transition-all",
        scrolled && "glass border-b border-border",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link href="/" aria-label="MIRAI home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              href={l.to}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {session ? (
            <Button asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </Button>
        </div>
      </nav>
      <div
        id="mobile-menu"
        className={cn(
          "fixed inset-0 z-50 flex flex-col bg-background p-6 transition-transform duration-300 md:hidden",
          open ? "translate-x-0 visible" : "translate-x-full invisible",
        )}
      >
        <div className="flex items-center justify-between">
          <Logo />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </div>
        <div className="mt-10 flex flex-col gap-6">
          {links.map((l) => (
            <Link
              key={l.to}
              href={l.to}
              onClick={() => setOpen(false)}
              className="font-display text-3xl"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="mt-auto grid gap-3">
          <Button variant="outline" size="lg" asChild>
            <Link href="/sign-in" onClick={() => setOpen(false)}>
              Sign in
            </Link>
          </Button>
          <Button size="lg" asChild>
            <Link href="/sign-up" onClick={() => setOpen(false)}>
              Get started
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="marine-surface border-t border-border">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo dark />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            Verified land records for Lagos & Ogun State: boundaries, documents, payments and site
            checks in one place.
          </p>
          <form
            className="mt-6 flex max-w-sm gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              toast("Demo newsletter form", {
                description:
                  "Your email was not sent or subscribed. Newsletter delivery will be connected later.",
              });
              (e.target as HTMLFormElement).reset();
            }}
          >
            <Input
              type="email"
              required
              placeholder="Be first to see what opens next"
              aria-label="Email"
            />
            <Button type="submit">Join</Button>
          </form>
        </div>
        <div className="grid gap-2 text-sm">
          <div className="text-low">Explore</div>
          {links.map((l) => (
            <Link key={l.to} href={l.to} className="text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="grid content-start gap-2 text-sm">
          <div className="text-low">Contact</div>
          <a
            href={`mailto:${COMPANY.supportEmail}`}
            className="break-all text-muted-foreground hover:text-foreground"
          >
            {COMPANY.supportEmail}
          </a>
          <Link href="/terms" className="text-muted-foreground hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
            Privacy
          </Link>
        </div>
      </div>
      <div className="border-t border-border px-5 py-5 text-center text-xs text-low">
        MIRAI is a technology platform, not an estate agency or investment scheme. © 2026 MIRAI.
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen animate-rise pt-16">
        {children}
      </main>
      <Footer />
    </>
  );
}
