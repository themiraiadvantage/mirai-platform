import states from "./nigeria-state-index.json";

export type MapBounds = [[number, number], [number, number]];
export type BoundaryPoint = { id: string; lat: number; lng: number };
export const NIGERIA_STATES = states.map((state) => state.name);
export const NIGERIA_BOUNDS: MapBounds = [
  [Math.min(...states.map((s) => s.bounds[0][0])), Math.min(...states.map((s) => s.bounds[0][1]))],
  [Math.max(...states.map((s) => s.bounds[1][0])), Math.max(...states.map((s) => s.bounds[1][1]))],
];
export function nigeriaStateName(value: string) {
  const name = value
    .trim()
    .toLowerCase()
    .replace(/\s+state$/, "");
  if (
    ["fct", "abuja", "abuja federal capital territory", "federal capital territory"].includes(name)
  )
    return "FCT";
  return NIGERIA_STATES.find((state) => state.toLowerCase() === name);
}
export function nigeriaStateBounds(value: string): MapBounds {
  const state = states.find((s) => s.name === nigeriaStateName(value));
  return state ? (state.bounds as MapBounds) : NIGERIA_BOUNDS;
}
export function boundaryCentre(points: BoundaryPoint[]) {
  if (!points.length) return null;
  return {
    latitude: (Math.min(...points.map((p) => p.lat)) + Math.max(...points.map((p) => p.lat))) / 2,
    longitude: (Math.min(...points.map((p) => p.lng)) + Math.max(...points.map((p) => p.lng))) / 2,
  };
}
export function addBoundaryPoint(points: BoundaryPoint[], latitude: number, longitude: number) {
  const lat = Number(latitude.toFixed(6)),
    lng = Number(longitude.toFixed(6));
  if (points.length >= 100 || points.some((p) => p.lat === lat && p.lng === lng)) return points;
  let next = 1;
  while (points.some((p) => p.id === `B${next}`)) next++;
  return [...points, { id: `B${next}`, lat, lng }];
}
