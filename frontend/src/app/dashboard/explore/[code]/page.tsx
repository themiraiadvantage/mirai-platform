import { LivePlotDetail } from "@/features/plots/LiveCatalogue";
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  return <LivePlotDetail code={(await params).code} workspace />;
}
