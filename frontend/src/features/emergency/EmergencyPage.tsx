import { MagnifyingGlassIcon, TargetIcon } from "@radix-ui/react-icons";
import { Button, Callout, Card, Flex, Spinner, Text, TextField } from "@radix-ui/themes";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "@/api/client";
import { configApi } from "@/api/config";
import { patientApi } from "@/api/patient";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorCallout } from "@/components/ui/ErrorCallout";
import type { CareSites } from "@/types/schema";
import { CareFilters } from "./CareFilters";
import { CareMap } from "./CareMap";
import { geocode, geocodeFacilities, searchNearby, type LngLat, type MapboxPlace } from "./mapbox";
import { applyFilters, DEFAULT_FILTERS, mergePlaces, type Filters } from "./places";
import { PlaceList } from "./PlaceList";

/** Morningside Heights, before the user searches. */
const DEFAULT_CENTER: LngLat = { lng: -73.9626, lat: 40.8075 };

/** Emergency Site: nearby ERs, hospitals and urgent care (Mapbox) merged with our facilities' insurance data. */
export function EmergencyPage() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [sites, setSites] = useState<CareSites | null>(null);
  const [coords, setCoords] = useState(new Map<number, LngLat>());
  const [nearby, setNearby] = useState<MapboxPlace[]>([]);
  const [origin, setOrigin] = useState<LngLat | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([configApi.map(), patientApi.careSites()])
      .then(([config, careSites]) => {
        setToken(config.mapbox_token);
        setSites(careSites);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load care sites."));
  }, []);

  // Pin our facilities once we have a token.
  useEffect(() => {
    if (token && sites) geocodeFacilities(token, sites.facilities).then(setCoords);
  }, [token, sites]);

  const searchAround = async (center: LngLat) => {
    if (!token) return;
    setOrigin(center);
    setSelectedId(null);
    setNearby(await searchNearby(token, center));
  };

  const run = async (task: () => Promise<void>) => {
    setSearching(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setError("Your browser can't share its location. Search by address or ZIP instead.");
      return;
    }
    setSearching(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => run(() => searchAround({ lng: pos.coords.longitude, lat: pos.coords.latitude })),
      () => {
        setSearching(false);
        setError("Location permission was denied. Search by address or ZIP instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const searchAddress = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || !token) return;
    run(async () => {
      const found = await geocode(token, q, DEFAULT_CENTER);
      if (!found) throw new Error(`Couldn't find "${q}". Try a street address or ZIP code.`);
      await searchAround(found);
    });
  };

  const places = useMemo(
    () => (sites ? applyFilters(mergePlaces(sites.facilities, coords, nearby, origin), filters) : []),
    [sites, coords, nearby, origin, filters],
  );
  const hasActivePlan = Boolean(sites?.plans.some((p) => p.is_mine_active));

  return (
    <PageContainer fullWidth backTo="/dashboard" title="Emergency Site" subtitle="Find nearby emergency rooms, hospitals and urgent care.">
      <Flex direction="column" gap="4">
        {loadError ? (
          <ErrorCallout message={loadError} />
        ) : !sites || token === undefined ? (
          <Flex justify="center" py="9">
            <Spinner size="3" />
          </Flex>
        ) : (
          <>
            {token ? (
              <Card size="2">
                <Flex gap="3" wrap="wrap" align="center">
                  <Button size="3" onClick={useMyLocation} disabled={searching}>
                    <TargetIcon /> Use my location
                  </Button>
                  <Text color="gray" size="2">
                    or
                  </Text>
                  <form onSubmit={searchAddress} style={{ display: "flex", gap: 8, flex: "1 1 280px" }}>
                    <TextField.Root
                      size="3"
                      placeholder="Address or ZIP code"
                      aria-label="Address or ZIP code"
                      maxLength={200}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <TextField.Slot>
                        <MagnifyingGlassIcon />
                      </TextField.Slot>
                    </TextField.Root>
                    <Button size="3" type="submit" variant="soft" loading={searching} disabled={!query.trim()}>
                      Search
                    </Button>
                  </form>
                </Flex>
                <Text as="div" size="1" color="gray" mt="2">
                  Your location or address is sent to Mapbox only to find places near you. It isn't saved.
                </Text>
              </Card>
            ) : (
              <Callout.Root color="gray">
                <Callout.Text>
                  The map isn't set up. Add a public Mapbox token as <code>MAPBOX_TOKEN=pk.…</code> in <code>.env</code> and
                  restart Flask. Health Rolodex facilities and their insurance are listed below.
                </Callout.Text>
              </Callout.Root>
            )}

            {error && <ErrorCallout message={error} />}

            <CareFilters filters={filters} plans={sites.plans} hasActivePlan={hasActivePlan} hasLocation={origin !== null} onChange={setFilters} />

            <Text size="2" color="gray">
              {places.length} place{places.length === 1 ? "" : "s"}
              {origin ? " near you, nearest first" : token ? ". Search to see distances and more places nearby" : ""}
            </Text>

            <div className={token ? "care-layout" : undefined}>
              <div className="care-list">
                <PlaceList places={places} insurance={filters.insurance} selectedId={selectedId} onSelect={setSelectedId} />
              </div>
              {token && (
                <CareMap
                  token={token}
                  center={origin ?? DEFAULT_CENTER}
                  origin={origin}
                  places={places}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}
            </div>
          </>
        )}
      </Flex>
    </PageContainer>
  );
}
