/** Display helpers. Dates arrive as ISO "YYYY-MM-DD" and are formatted without timezone shifts. */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Only http(s) links are clickable, so a stored value can't become a javascript: URL. */
export function safeHref(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** provider.rating is numeric(2,1): always show one decimal, e.g. 4.0. */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/** Dropdown label for a provider: "Dr. Name · ★ 4.6 · Cardiology". */
export function providerOptionLabel(p: { provider_name: string; rating?: number | null; specialities?: string }): string {
  return [p.provider_name, p.rating != null ? `★ ${formatRating(p.rating)}` : "", p.specialities ?? ""]
    .filter(Boolean)
    .join(" · ");
}

/** Whole years since an ISO date of birth. */
export function ageFrom(dob: string): number {
  const [y, m, d] = dob.slice(0, 10).split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}
