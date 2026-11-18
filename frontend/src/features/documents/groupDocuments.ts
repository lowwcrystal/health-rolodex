import { parseDocumentKind, type DocumentKind, type HealthRecord, type ISODate } from "@/types/schema";

/** One document as the user thinks of it. A two-sided card is two records rows joined back together. */
export interface DocumentGroup {
  key: string;
  kind: DocumentKind;
  notes: string | null;
  uploadDate: ISODate;
  isShareable: boolean;
  front: HealthRecord | null;
  back: HealthRecord | null;
  /** Single-file documents */
  file: HealthRecord | null;
  sharedWith: string[];
}

export function groupDocuments(records: HealthRecord[]): DocumentGroup[] {
  const sorted = [...records].sort((a, b) => a.record_no - b.record_no);
  const groups: DocumentGroup[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const rec = sorted[i];
    const parsed = parseDocumentKind(rec.record_type, rec.notes);
    const next = sorted[i + 1];
    const nextParsed = next ? parseDocumentKind(next.record_type, next.notes) : null;
    const pairsWithNext =
      parsed.side === "front" &&
      next !== undefined &&
      nextParsed?.side === "back" &&
      nextParsed.kind === parsed.kind &&
      next.record_no === rec.record_no + 1 &&
      next.upload_date === rec.upload_date;

    const sharedNames = new Set(rec.shared_with.map((p) => p.provider_name));
    if (pairsWithNext) next.shared_with.forEach((p) => sharedNames.add(p.provider_name));

    groups.push({
      key: `${rec.record_no}`,
      kind: parsed.kind,
      notes: parsed.notes,
      uploadDate: rec.upload_date,
      isShareable: rec.is_shareable,
      front: parsed.side === "front" ? rec : null,
      back: pairsWithNext ? next : parsed.side === "back" ? rec : null,
      file: parsed.side === null ? rec : null,
      sharedWith: [...sharedNames].sort(),
    });
    if (pairsWithNext) i++;
  }

  return groups.sort((a, b) => b.uploadDate.localeCompare(a.uploadDate) || Number(b.key) - Number(a.key));
}
