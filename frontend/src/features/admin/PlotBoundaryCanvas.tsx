"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoJsonObject } from "geojson";
import nigeriaGeometry from "@/lib/nigeria-states.json";
import {
  addBoundaryPoint,
  nigeriaStateBounds,
  nigeriaStateName,
  NIGERIA_BOUNDS,
  type BoundaryPoint,
} from "@/lib/nigeria-map";

type Props = {
  state: string;
  points: BoundaryPoint[];
  onChange: (points: BoundaryPoint[]) => void;
};
export default function PlotBoundaryCanvas(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const regionRef = useRef<L.GeoJSON | null>(null);
  const boundaryRef = useRef<L.LayerGroup | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const drawingRef = useRef(false);
  const [drawing, setDrawing] = useState(false);
  const [clear, setClear] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [ready, setReady] = useState(false);
  const lastState = useRef<string | null>(null);
  const setMode = useCallback((value: boolean) => {
    drawingRef.current = value;
    setDrawing(value);
    setClear(false);
  }, []);
  const fitRegion = useCallback(() => {
    mapRef.current?.fitBounds(nigeriaStateBounds(latest.current.state), {
      padding: [28, 28],
      maxZoom: 11,
    });
  }, []);
  const fitPlot = useCallback(() => {
    const points = latest.current.points;
    if (points.length)
      mapRef.current?.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), {
        padding: [70, 70],
        maxZoom: 19,
      });
    else fitRegion();
  }, [fitRegion]);
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, {
      zoomControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: false,
      maxBounds: L.latLngBounds(NIGERIA_BOUNDS).pad(0.35),
      maxBoundsViscosity: 0.8,
      minZoom: 5,
      maxZoom: 19,
    });
    mapRef.current = map;
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);
    const street = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles © Esri", maxZoom: 19 },
    );
    const imagery = L.tileLayer(
      process.env.NEXT_PUBLIC_MAP_TILE_URL ||
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "Imagery © Esri, Maxar, Earthstar Geographics",
        maxZoom: 19,
      },
    );
    const labels = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 },
    );
    const satellite = L.layerGroup([imagery, labels]);
    for (const tiles of [street, imagery]) {
      tiles.on("tileerror", () => setTileError(true));
      tiles.on("tileload", () => setTileError(false));
    }
    street.addTo(map);
    L.control
      .layers({ "Street map": street, Satellite: satellite }, undefined, { position: "topright" })
      .addTo(map);
    const regions = L.geoJSON(nigeriaGeometry as GeoJsonObject, {
      interactive: false,
      style: { color: "#4e7886", weight: 1, opacity: 0.65, fillOpacity: 0.025 },
    }).addTo(map);
    regionRef.current = regions;
    boundaryRef.current = L.layerGroup().addTo(map);
    map.attributionControl.addAttribution(
      'States: <a href="https://www.geoboundaries.org/" target="_blank" rel="noopener noreferrer">geoBoundaries / GRID3</a> · CC BY 4.0',
    );
    map.on("click", (event: L.LeafletMouseEvent) => {
      if (!drawingRef.current) return;
      const current = latest.current;
      current.onChange(addBoundaryPoint(current.points, event.latlng.lat, event.latlng.lng));
    });
    const resize =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => map.invalidateSize({ pan: false }))
        : null;
    resize?.observe(container.current);
    setReady(true);
    return () => {
      resize?.disconnect();
      map.remove();
      mapRef.current = null;
      regionRef.current = null;
      boundaryRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const chosen = nigeriaStateName(props.state);
    regionRef.current?.setStyle((feature) => ({
      color:
        nigeriaStateName(String(feature?.properties.name || "")) === chosen && chosen
          ? "#a16b25"
          : "#4e7886",
      weight: nigeriaStateName(String(feature?.properties.name || "")) === chosen && chosen ? 2 : 1,
      fillOpacity:
        nigeriaStateName(String(feature?.properties.name || "")) === chosen && chosen
          ? 0.08
          : 0.025,
    }));
    if (lastState.current === null && latest.current.points.length) fitPlot();
    else fitRegion();
    lastState.current = props.state;
  }, [props.state, ready, fitPlot, fitRegion]);
  useEffect(() => {
    const layers = boundaryRef.current;
    if (!ready || !layers) return;
    layers.clearLayers();
    const points = props.points;
    const coordinates = points.map((p) => [p.lat, p.lng] as L.LatLngTuple);
    if (points.length >= 3)
      L.polygon(coordinates, {
        color: "#a16b25",
        weight: 3,
        fillColor: "#dca850",
        fillOpacity: 0.2,
        interactive: false,
      }).addTo(layers);
    else if (points.length > 1)
      L.polyline(coordinates, {
        color: "#a16b25",
        weight: 3,
        dashArray: "6 5",
        interactive: false,
      }).addTo(layers);
    points.forEach((point, index) => {
      const icon = L.divIcon({
        className: "admin-boundary-corner",
        html: `<span>${index + 1}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const marker = L.marker([point.lat, point.lng], {
        icon,
        draggable: true,
        keyboard: true,
        title: `Boundary corner ${index + 1}. Drag to adjust.`,
        bubblingMouseEvents: false,
      }).addTo(layers);
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        const current = latest.current;
        current.onChange(
          current.points.map((p, i) =>
            i === index
              ? { ...p, lat: Number(position.lat.toFixed(6)), lng: Number(position.lng.toFixed(6)) }
              : p,
          ),
        );
      });
      marker.on("click", () => {
        if (index === 0 && latest.current.points.length >= 3) setMode(false);
      });
    });
  }, [props.points, ready, setMode]);
  return (
    <>
      <div
        ref={container}
        className="admin-boundary-canvas"
        role="region"
        aria-label={`Interactive plot map of ${nigeriaStateName(props.state) || "Nigeria"}`}
      />
      <div className="admin-boundary-heading">
        <span className="admin-boundary-region">{nigeriaStateName(props.state) || "Nigeria"}</span>
        <strong>
          {drawing
            ? "Mark each corner of the plot"
            : props.points.length >= 3
              ? "Your plot boundary"
              : "Locate your plot on the map"}
        </strong>
        <p>
          {drawing
            ? "Click corners in order, then finish. Drag a corner to adjust."
            : "Zoom to the site, then draw its boundary to match the survey."}
        </p>
      </div>
      <div className="admin-boundary-tools" role="group" aria-label="Map boundary controls">
        <button
          type="button"
          className={drawing ? "is-active" : ""}
          onClick={() => setMode(!drawing)}
        >
          {drawing ? "Finish drawing" : props.points.length ? "Add corners" : "Draw boundary"}
        </button>
        <button
          type="button"
          disabled={!props.points.length}
          onClick={() => props.onChange(props.points.slice(0, -1))}
        >
          Undo corner
        </button>
        <button type="button" onClick={fitRegion}>
          {nigeriaStateName(props.state) ? "Fit state" : "Fit Nigeria"}
        </button>
        {!!props.points.length && (
          <button type="button" onClick={fitPlot}>
            Fit plot
          </button>
        )}
        {!!props.points.length && (
          <button
            type="button"
            onClick={() => {
              if (!clear) setClear(true);
              else {
                props.onChange([]);
                setClear(false);
                setMode(false);
              }
            }}
          >
            {clear ? "Confirm clear" : "Clear boundary"}
          </button>
        )}
        {clear && (
          <button type="button" onClick={() => setClear(false)}>
            Keep boundary
          </button>
        )}
        <span aria-live="polite">
          {props.points.length} {props.points.length === 1 ? "corner" : "corners"}
        </span>
      </div>
      {tileError && (
        <div className="admin-boundary-tile-error" role="status">
          Map imagery is unavailable. Check your connection or switch map layers.
        </div>
      )}
    </>
  );
}
