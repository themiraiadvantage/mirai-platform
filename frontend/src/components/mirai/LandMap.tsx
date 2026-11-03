// Browser-only: imports Leaflet. Always load via React.lazy behind <ClientOnly>.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Plot } from "@/lib/data";

export default function LandMap({
  plots,
  focus,
  onSelect,
  className,
}: {
  plots: Plot[];
  focus?: string;
  onSelect?: (code: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const sel = useRef(onSelect);
  sel.current = onSelect;
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });
    L.tileLayer(
      process.env.NEXT_PUBLIC_MAP_TILE_URL ||
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution:
          process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "Imagery © Esri, Maxar, Earthstar Geographics",
      },
    ).addTo(map);
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, opacity: 0.8 },
    ).addTo(map);
    const css = getComputedStyle(document.documentElement);
    const gold = css.getPropertyValue("--brand-gold").trim() || "#df9f53";
    const marine = css.getPropertyValue("--marine-deep").trim() || "#00101a";
    const layers: L.LatLngExpression[] = [];
    const label = (text: string) => {
      const span = document.createElement("span");
      span.textContent = text;
      return span;
    };
    plots.forEach((p) => {
      const pts = p.beacons.map((b) => [b.lat, b.lng] as [number, number]);
      if (pts.length >= 3) {
        const poly = L.polygon(pts, {
          color: gold,
          weight: 2,
          fillColor: marine,
          fillOpacity: 0.3,
        }).addTo(map);
        poly.bindTooltip(label(`${p.code} · ${p.location} · ${p.size} sqm`));
        poly.on("click", () => sel.current?.(p.code));
      }
      if (plots.length > 1 || pts.length < 3) {
        L.circleMarker(p.centre, {
          radius: 7,
          color: gold,
          fillColor: gold,
          fillOpacity: 0.9,
          weight: 2,
        })
          .bindTooltip(label(`${p.code} · ${p.location}`))
          .on("click", () => sel.current?.(p.code))
          .addTo(map);
      } else {
        p.beacons.forEach((b) =>
          L.circleMarker([b.lat, b.lng], {
            radius: 5,
            color: gold,
            fillColor: gold,
            fillOpacity: 1,
          })
            .bindTooltip(label(`Beacon ${b.id}`), {
              permanent: true,
              direction: "top",
              className: "beacon-tip",
            })
            .addTo(map),
        );
      }
      layers.push(...(pts.length ? pts : [p.centre]));
    });
    const f = plots.find((p) => p.code === focus);
    if (f?.beacons.length)
      map.fitBounds(L.latLngBounds(f.beacons.map((b) => [b.lat, b.lng])), {
        padding: [60, 60],
        maxZoom: 19,
      });
    else if (f) map.setView(f.centre, 16);
    else if (layers.length)
      map.fitBounds(L.latLngBounds(layers), { padding: [40, 40], maxZoom: 18 });
    else map.setView([6.5, 3.5], 10);
    return () => {
      map.remove();
    };
  }, [plots, focus]);
  return (
    <div
      ref={ref}
      className={className ?? "h-full w-full"}
      role="region"
      aria-label="Satellite map of plot boundaries"
    />
  );
}
