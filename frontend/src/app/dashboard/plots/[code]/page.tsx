import PlotRecord from "@/features/dashboard/PlotRecord";
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  return <PlotRecord code={(await params).code} />;
}
