import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";
import type { LngLat } from "./mapbox";
import { KIND_LABELS, type Place } from "./places";

interface Props {
  token: string;
  center: LngLat;
  origin: LngLat | null;
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function markerColor(p: Place): string {
  if (p.source === "mapbox") return p.kind === "er" ? "#e5484d" : "#8b8d98";
  return p.inNetwork ? "#30a46c" : "#1b2b4b";
}

/** mapbox-gl map: a "you are here" pin plus one pin per filtered place. Popups use text only (no HTML). */
export function CareMap({ token, center, origin, places, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef(new Map<string, mapboxgl.Marker>());
  const originMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [center.lng, center.lat],
      zoom: 12,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    const markers = markersRef.current;
    return () => {
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // "You are here"
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    originMarkerRef.current?.remove();
    originMarkerRef.current = origin
      ? new mapboxgl.Marker({ color: "#3e63dd", scale: 0.8 })
          .setLngLat([origin.lng, origin.lat])
          .setPopup(new mapboxgl.Popup({ offset: 20 }).setText("You are here"))
          .addTo(map)
      : null;
  }, [origin]);

  // One marker per place; fit the view to them.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    markers.forEach((m) => m.remove());
    markers.clear();

    const bounds = new mapboxgl.LngLatBounds();
    for (const p of places) {
      if (p.lng == null || p.lat == null) continue;
      const popup = new mapboxgl.Popup({ offset: 25 }).setText(`${p.name}\n${KIND_LABELS[p.kind]} · ${p.address}`);
      const marker = new mapboxgl.Marker({ color: markerColor(p) }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
      marker.getElement().addEventListener("click", () => onSelectRef.current(p.id));
      marker.getElement().setAttribute("aria-label", p.name);
      markers.set(p.id, marker);
      bounds.extend([p.lng, p.lat]);
    }
    if (origin) bounds.extend([origin.lng, origin.lat]);
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 });
  }, [places, origin]);

  // Fly to the selected place and open its popup.
  useEffect(() => {
    const map = mapRef.current;
    const marker = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (!map || !marker) return;
    markersRef.current.forEach((m) => {
      if (m !== marker && m.getPopup()?.isOpen()) m.togglePopup();
    });
    map.flyTo({ center: marker.getLngLat(), zoom: Math.max(map.getZoom(), 14) });
    if (!marker.getPopup()?.isOpen()) marker.togglePopup();
  }, [selectedId]);

  return <div ref={containerRef} className="care-map" role="region" aria-label="Map of nearby care" />;
}
