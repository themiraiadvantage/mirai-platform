import AdminPlotEditor from "@/features/admin/AdminPlotEditor";
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  return <AdminPlotEditor key={(await params).code} code={(await params).code} />;
}
