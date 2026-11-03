import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!origin) return [];
  return [
    "",
    "/plots",
    "/how-it-works",
    "/site-checks",
    "/co-own",
    "/fees",
    "/faq",
    "/privacy",
    "/terms",
  ].map((path) => ({ url: origin + path }));
}
