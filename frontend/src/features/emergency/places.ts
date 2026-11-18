/** Pure logic for the care finder: merge our facilities with Mapbox places, measure distance, filter. */
import type { CareFacility } from "@/types/schema";
import type { LngLat, MapboxPlace, PlaceKind } from "./mapbox";

export interface Place {
  id: string;
  source: "rolodex" | "mapbox";
  name: string;
  address: string;
  kind: PlaceKind;
  lng: number | null;
  lat: number | null;
  phone?: string;
  /** null until we know both the place's and the user's position. */
  distanceMi: number | null;
  /** Rolodex facilities only (accepts ⋈ insuranceplan). */
  acceptedPlanIds?: number[];
  acceptedPlanNames?: string[];
  inNetwork?: boolean;
  myVisits?: number;
  lastVisit?: string | null;
}

export type InsuranceFilter = "any" | "mine" | `plan:${number}`;

export interface Filters {
  insurance: InsuranceFilter;
  includeUnknown: boolean;
  kinds: PlaceKind[];
  maxMiles: number | null;
  visitedOnly: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  insurance: "any",
  includeUnknown: true,
  kinds: ["er", "hospital", "urgent_care"],
  maxMiles: 10,
  visitedOnly: false,
};

export const KIND_LABELS: Record<PlaceKind, string> = { er: "Emergency room", hospital: "Hospital", urgent_care: "Urgent care" };

export function milesBetween(a: LngLat, b: LngLat): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const SAME_PLACE_MILES = 0.125; // ~200 m

/**
 * One list from both sources. A Mapbox POI within ~200 m of one of our facilities is the same hospital,
 * so it's folded in (our insurance data wins; Mapbox adds the phone and ER kind).
 */
export function mergePlaces(
  facilities: CareFacility[],
  coords: Map<number, LngLat>,
  nearby: MapboxPlace[],
  origin: LngLat | null,
): Place[] {
  const ours: Place[] = facilities.map((f) => {
    const c = coords.get(f.facility_id) ?? null;
    return {
      id: `facility-${f.facility_id}`,
      source: "rolodex",
      name: f.facility_name,
      address: f.address,
      kind: "hospital",
      lng: c?.lng ?? null,
      lat: c?.lat ?? null,
      distanceMi: null,
      acceptedPlanIds: f.accepted_plans.map((p) => p.plan_id),
      acceptedPlanNames: f.accepted_plans.map((p) => p.plan_name),
      inNetwork: f.in_network,
      myVisits: f.my_visits,
      lastVisit: f.last_visit,
    };
  });

  const others: Place[] = [];
  for (const m of nearby) {
    const twin = ours.find((o) => o.lng != null && o.lat != null && milesBetween(m, { lng: o.lng, lat: o.lat! }) < SAME_PLACE_MILES);
    if (twin) {
      twin.phone ??= m.phone;
      if (m.kind === "er") twin.kind = "er";
      continue;
    }
    others.push({ ...m, source: "mapbox", distanceMi: null });
  }

  const all = [...ours, ...others];
  if (origin) {
    for (const p of all) {
      if (p.lng != null && p.lat != null) p.distanceMi = milesBetween(origin, { lng: p.lng, lat: p.lat });
    }
  }
  return all;
}

/** Does this place take the chosen insurance? undefined = unknown (a Mapbox place). */
export function acceptsInsurance(p: Place, insurance: InsuranceFilter): boolean | undefined {
  if (insurance === "any") return true;
  if (p.source === "mapbox") return undefined;
  if (insurance === "mine") return Boolean(p.inNetwork);
  return p.acceptedPlanIds?.includes(Number(insurance.slice("plan:".length))) ?? false;
}

export function applyFilters(places: Place[], f: Filters): Place[] {
  return places
    .filter((p) => {
      const ins = acceptsInsurance(p, f.insurance);
      if (ins === false) return false;
      if (ins === undefined && !f.includeUnknown) return false;
      if (!f.kinds.includes(p.kind)) return false;
      if (f.visitedOnly && !p.myVisits) return false;
      if (f.maxMiles != null && p.distanceMi != null && p.distanceMi > f.maxMiles) return false;
      // Mapbox places are only meaningful with a distance; ours stay listed even before a search.
      if (f.maxMiles != null && p.distanceMi == null && p.source === "mapbox") return false;
      return true;
    })
    .sort((a, b) => (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity) || a.name.localeCompare(b.name));
}

export function directionsUrl(p: Place): string {
  const destination = p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : p.address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
