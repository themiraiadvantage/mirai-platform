import type { Metadata } from "next";
import "../styles.css";
import { Providers } from "./providers";
export const metadata: Metadata = {
  title: { default: "MIRAI | Own it with proof", template: "%s | MIRAI" },
  description:
    "Explore land in Lagos and Ogun with boundaries, documents, site checks and payments in one clear record.",
  openGraph: {
    title: "MIRAI | Own it with proof",
    description: "Your next chapter starts on solid ground.",
    type: "website",
  },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&family=Instrument+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
