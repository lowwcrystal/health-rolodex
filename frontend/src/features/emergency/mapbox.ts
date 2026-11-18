/** Mapbox Search Box (nearby POIs) and Geocoding v6 (addresses). Every value goes through URLSearchParams. */

export type PlaceKind = "er" | "hospital" | "urgent_care";

export interface LngLat {
  lng: number;
  lat: number;
}

export interface MapboxPlace extends LngLat {
  id: string;
  name: string;
  address: string;
  kind: PlaceKind;
  phone?: string;
}

/** Search Box category ids → our kinds. A category Mapbox doesn't support is skipped. */
const CATEGORIES: [string, PlaceKind][] = [
  ["emergency_room", "er"],
  ["hospital", "hospital"],
  ["urgent_care", "urgent_care"],
];

interface SearchBoxFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    mapbox_id?: string;
    name?: string;
    full_address?: string;
    address?: string;
    place_formatted?: string;
    metadata?: { phone?: string };
  };
}

async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Can't reach Mapbox. Check your connection.");
  }
  if (response.status === 401) throw new Error("The Mapbox token was rejected. Check MAPBOX_TOKEN in .env.");
  if (!response.ok) throw new Error(`Mapbox request failed (${response.status}).`);
  return response.json();
}

/** Hospitals, ERs and urgent care near a point, deduped by mapbox_id. Kind priority: ER > urgent care > hospital. */
export async function searchNearby(token: string, center: LngLat): Promise<MapboxPlace[]> {
  const results = await Promise.allSettled(
    CATEGORIES.map(async ([category, kind]) => {
      const params = new URLSearchParams({
        access_token: token,
        proximity: `${center.lng},${center.lat}`,
        limit: "25",
        language: "en",
      });
      const data = (await getJson(
        `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(category)}?${params}`,
      )) as { features?: SearchBoxFeature[] };
      return (data.features ?? []).map((f) => ({ f, kind }));
    }),
  );

  const fulfilled = results.filter((r): r is PromiseFulfilledResult<{ f: SearchBoxFeature; kind: PlaceKind }[]> => r.status === "fulfilled");
  if (fulfilled.length === 0) {
    const first = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    throw first?.reason instanceof Error ? first.reason : new Error("Couldn't search nearby places.");
  }

  const byId = new Map<string, MapboxPlace>();
  for (const { f, kind } of fulfilled.flatMap((r) => r.value)) {
    const coords = f.geometry?.coordinates;
    const p = f.properties;
    if (!coords || !p?.name) continue;
    const id = p.mapbox_id ?? `${p.name}@${coords.join(",")}`;
    const existing = byId.get(id);
    if (existing) {
      if (kind === "er" || (kind === "urgent_care" && existing.kind === "hospital")) existing.kind = kind;
      continue;
    }
    byId.set(id, {
      id,
      name: p.name,
      address: p.full_address ?? [p.address, p.place_formatted].filter(Boolean).join(", "),
      kind,
      phone: p.metadata?.phone,
      lng: coords[0],
      lat: coords[1],
    });
  }
  return [...byId.values()];
}

/** First match for an address or ZIP, biased toward `near` when given. */
export async function geocode(token: string, query: string, near?: LngLat): Promise<LngLat | null> {
  const params = new URLSearchParams({ access_token: token, q: query, limit: "1", country: "us" });
  if (near) params.set("proximity", `${near.lng},${near.lat}`);
  const data = (await getJson(`https://api.mapbox.com/search/geocode/v6/forward?${params}`)) as {
    features?: { geometry?: { coordinates?: [number, number] } }[];
  };
  const coords = data.features?.[0]?.geometry?.coordinates;
  return coords ? { lng: coords[0], lat: coords[1] } : null;
}

const CACHE_KEY = "care-finder-facility-coords-v1";

/** Geocode our facility addresses once per browser session (sessionStorage; works without it too). */
export async function geocodeFacilities(
  token: string,
  facilities: { facility_id: number; address: string }[],
): Promise<Map<number, LngLat>> {
  let cache: Record<string, LngLat> = {};
  try {
    cache = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, LngLat>;
  } catch {
    cache = {};
  }
  const out = new Map<number, LngLat>();
  await Promise.all(
    facilities.map(async (f) => {
      const key = `${f.facility_id}|${f.address}`;
      const hit = cache[key];
      if (hit) {
        out.set(f.facility_id, hit);
        return;
      }
      try {
        const found = await geocode(token, f.address);
        if (found) {
          cache[key] = found;
          out.set(f.facility_id, found);
        }
      } catch {
        // One failed lookup shouldn't hide the rest; that facility just has no pin.
      }
    }),
  );
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage blocked (private mode); fine.
  }
  return out;
}
