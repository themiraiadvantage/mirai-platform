import { AppShell } from "@/components/mirai/AppShell";
export const metadata = {
  title: "Your ownership workspace",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
