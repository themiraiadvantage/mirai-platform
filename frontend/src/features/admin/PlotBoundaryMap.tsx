"use client";
import dynamic from "next/dynamic";
import { boundaryCentre, type BoundaryPoint } from "@/lib/nigeria-map";
import type { LivePlot } from "@/lib/property-api";

const BoundaryCanvas = dynamic(() => import("./PlotBoundaryCanvas"), {
  ssr: false,
  loading: () => (
    <div className="admin-boundary-loading" role="status">
      Opening Nigeria map…
    </div>
  ),
});
export function PlotBoundaryMap({
  plot,
  change,
}: {
  plot: LivePlot;
  change: (patch: Partial<LivePlot>) => void;
}) {
  const update = (beacons: BoundaryPoint[]) =>
    change({ details: { ...plot.details, beacons, ...boundaryCentre(beacons) } });
  return (
    <div className="admin-boundary-map">
      <BoundaryCanvas state={plot.state} points={plot.details.beacons || []} onChange={update} />
    </div>
  );
}
