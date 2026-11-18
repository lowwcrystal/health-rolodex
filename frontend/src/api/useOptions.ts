import { useEffect, useState } from "react";
import { authApi, type Options } from "./auth";

let cached: Promise<Options> | null = null;

/** Dropdown data (providers, pharmacies, plans, conditions) from GET /api/options, fetched once per page load. */
export function useOptions(): Options | null {
  const [options, setOptions] = useState<Options | null>(null);
  useEffect(() => {
    cached ??= authApi.options().catch((err) => {
      cached = null;
      throw err;
    });
    let live = true;
    cached.then((o) => live && setOptions(o)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return options;
}
