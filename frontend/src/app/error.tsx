"use client";
import { Logo } from "@/components/mirai/primitives";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <Logo className="justify-center" />
        <h1 className="mt-4 text-4xl">We couldn’t load this record.</h1>
        <p className="mt-3 text-muted-foreground">Try loading the page again.</p>
        <button onClick={reset} className="mt-6 rounded-xl bg-primary px-6 py-3 text-white">
          Try again
        </button>
      </div>
    </main>
  );
}
