import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlotBoundaryCanvas from "./PlotBoundaryCanvas";
import {
  addBoundaryPoint,
  boundaryCentre,
  nigeriaStateBounds,
  nigeriaStateName,
  NIGERIA_BOUNDS,
  NIGERIA_STATES,
  type BoundaryPoint,
} from "@/lib/nigeria-map";

const mocks = vi.hoisted(() => ({
  map: vi.fn(),
  fitBounds: vi.fn(),
  remove: vi.fn(),
  invalidateSize: vi.fn(),
  click: null as null | ((event: { latlng: { lat: number; lng: number } }) => void),
  polygon: vi.fn(),
  change: vi.fn(),
  markers: [] as { events: Record<string, () => void>; getLatLng: ReturnType<typeof vi.fn> }[],
}));
vi.mock("leaflet", () => {
  const layer = () => ({
    addTo: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(),
    setStyle: vi.fn(),
  });
  mocks.map.mockImplementation(() => ({
    fitBounds: mocks.fitBounds,
    remove: mocks.remove,
    invalidateSize: mocks.invalidateSize,
    attributionControl: { addAttribution: vi.fn() },
    on: (name: string, callback: typeof mocks.click) => {
      if (name === "click") mocks.click = callback;
    },
  }));
  mocks.polygon.mockImplementation(layer);
  return {
    default: {
      map: mocks.map,
      control: { zoom: layer, scale: layer, layers: layer },
      tileLayer: layer,
      layerGroup: layer,
      geoJSON: layer,
      polygon: mocks.polygon,
      polyline: layer,
      divIcon: vi.fn(),
      latLngBounds: (points: unknown) => ({ points, pad: vi.fn().mockReturnThis() }),
      marker: () => {
        const marker = {
          events: {} as Record<string, () => void>,
          getLatLng: vi.fn().mockReturnValue({ lat: 6.55, lng: 3.51 }),
          addTo: vi.fn().mockReturnThis(),
          on(name: string, callback: () => void) {
            this.events[name] = callback;
            return this;
          },
        };
        mocks.markers.push(marker);
        return marker;
      },
    },
  };
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.markers.length = 0;
});
afterEach(cleanup);
function EditableMap() {
  const [points, setPoints] = useState<BoundaryPoint[]>([]);
  return (
    <PlotBoundaryCanvas
      state="Lagos"
      points={points}
      onChange={(next) => {
        mocks.change(next);
        setPoints(next);
      }}
    />
  );
}

describe("Nigeria state map", () => {
  it("contains all states and FCT, handles existing state aliases and falls back to Nigeria", () => {
    expect(NIGERIA_STATES).toHaveLength(37);
    expect(nigeriaStateName(" lagos STATE ")).toBe("Lagos");
    expect(nigeriaStateName("Abuja Federal Capital Territory")).toBe("FCT");
    expect(nigeriaStateBounds("Abuja")).toEqual(nigeriaStateBounds("FCT"));
    expect(nigeriaStateBounds("")).toEqual(NIGERIA_BOUNDS);
    expect(nigeriaStateBounds("Unknown")).toEqual(NIGERIA_BOUNDS);
    expect(nigeriaStateBounds("Lagos")).not.toEqual(nigeriaStateBounds("Ogun"));
  });
  it("shows Nigeria initially and re-centres on a selected state without remounting or changing saved corners", async () => {
    const change = vi.fn();
    const view = render(<PlotBoundaryCanvas state="" points={[]} onChange={change} />);
    await waitFor(() =>
      expect(mocks.fitBounds).toHaveBeenCalledWith(NIGERIA_BOUNDS, expect.anything()),
    );
    view.rerender(<PlotBoundaryCanvas state="Ogun" points={[]} onChange={change} />);
    await waitFor(() =>
      expect(mocks.fitBounds).toHaveBeenLastCalledWith(
        nigeriaStateBounds("Ogun"),
        expect.anything(),
      ),
    );
    expect(
      screen.getByRole("region", { name: "Interactive plot map of Ogun" }),
    ).toBeInTheDocument();
    expect(mocks.map).toHaveBeenCalledTimes(1);
    expect(change).not.toHaveBeenCalled();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });
  it("draws real coordinates, adjusts a corner and undoes the last corner without resetting the viewport", async () => {
    render(<EditableMap />);
    await screen.findByRole("button", { name: "Draw boundary" });
    fireEvent.click(screen.getByRole("button", { name: "Draw boundary" }));
    for (const [lat, lng] of [
      [6.5, 3.5],
      [6.501, 3.5],
      [6.5, 3.501],
    ])
      act(() => mocks.click!({ latlng: { lat, lng } }));
    expect(screen.getByText("3 corners")).toBeInTheDocument();
    expect(mocks.polygon).toHaveBeenCalledWith(
      [
        [6.5, 3.5],
        [6.501, 3.5],
        [6.5, 3.501],
      ],
      expect.anything(),
    );
    const points = mocks.change.mock.calls.at(-1)![0];
    const centre = boundaryCentre(points)!;
    expect(centre.latitude).toBeCloseTo(6.5005, 6);
    expect(centre.longitude).toBeCloseTo(3.5005, 6);
    const currentCorner = mocks.markers.at(-3)!;
    act(() => currentCorner.events.dragend());
    expect(mocks.change.mock.calls.at(-1)![0][0]).toMatchObject({ lat: 6.55, lng: 3.51 });
    fireEvent.click(screen.getByRole("button", { name: "Undo corner" }));
    expect(screen.getByText("2 corners")).toBeInTheDocument();
    expect(mocks.fitBounds).toHaveBeenCalledTimes(1);
  });
  it("requires confirmation before clearing saved geometry", async () => {
    const points = [
      { id: "A", lat: 6.5, lng: 3.5 },
      { id: "B", lat: 6.501, lng: 3.5 },
      { id: "C", lat: 6.5, lng: 3.501 },
    ];
    render(<PlotBoundaryCanvas state="Lagos" points={points} onChange={mocks.change} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear boundary" }));
    expect(mocks.change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep boundary" }));
    expect(mocks.change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Clear boundary" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm clear" }));
    expect(mocks.change).toHaveBeenCalledWith([]);
  });
  it("keeps unique corner IDs after editing and rejects duplicate or excessive points", () => {
    const points = [
      { id: "B1", lat: 6.5, lng: 3.5 },
      { id: "B3", lat: 6.501, lng: 3.5 },
    ];
    expect(addBoundaryPoint(points, 6.5, 3.501).at(-1)?.id).toBe("B2");
    expect(addBoundaryPoint(points, 6.5, 3.5)).toBe(points);
    const maximum = Array.from({ length: 100 }, (_, i) => ({
      id: `B${i}`,
      lat: i / 100,
      lng: i / 100,
    }));
    expect(addBoundaryPoint(maximum, 6, 3)).toBe(maximum);
    expect(boundaryCentre([])).toBeNull();
  });
});
