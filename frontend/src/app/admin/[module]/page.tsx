import { notFound } from "next/navigation";
import AdminWorkspace from "@/features/admin/AdminWorkspace";
const modules = [
  "plots",
  "payments",
  "documents",
  "site-checks",
  "customers",
  "announcements",
  "audit",
  "staff",
  "reservations",
  "co-ownership",
  "settings",
  "catalogue",
];
export default async function Page({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (!modules.includes(module)) notFound();
  return <AdminWorkspace module={module} />;
}
