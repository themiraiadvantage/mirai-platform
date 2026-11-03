import Link from "next/link";
import { Logo, ParcelSvg } from "@/components/mirai/primitives";
export default function NotFound() {
  return (
    <main className="contour-bg flex min-h-screen items-center justify-center px-5 text-center">
      <div>
        <Logo className="justify-center" />
        <ParcelSvg
          shape={[
            [15, 20],
            [85, 10],
            [80, 85],
            [10, 70],
          ]}
          className="mx-auto my-6 h-36"
        />
        <p className="text-xs tracking-widest text-gold">404 · UNCHARTED TERRITORY</p>
        <h1 className="mt-4 text-4xl">This plot isn’t on our map.</h1>
        <p className="mt-3 text-muted-foreground">Let’s get you back to familiar ground.</p>
        <Link href="/plots" className="mt-6 inline-flex rounded-xl bg-primary px-6 py-3 text-white">
          Explore the catalogue →
        </Link>
      </div>
    </main>
  );
}
