import { get } from "./client";

/** Runtime config from Flask. The Mapbox token is a public pk. token (MAPBOX_TOKEN in .env), or null. */
export const configApi = {
  map: () => get<{ mapbox_token: string | null }>("/config/map"),
};
