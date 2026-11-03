import AdminShell from "@/features/admin/AdminShell";
import "@/features/admin/admin.css";
export const metadata = {
  title: "MIRAI Admin",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
