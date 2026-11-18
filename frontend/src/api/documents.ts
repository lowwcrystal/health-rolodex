import type { DocumentKind } from "@/types/schema";
import { post } from "./client";

export interface CreateDocumentInput {
  kind: DocumentKind;
  notes: string;
  /** Two-sided kinds (cards, ID) */
  front_url?: string;
  back_url?: string;
  /** Single-file kinds */
  file_url?: string;
  is_shareable: boolean;
  provider_ids: number[];
}

export const documentsApi = {
  create: (input: CreateDocumentInput) =>
    post<{ kind: DocumentKind; record_nos: number[]; shared_with: number[] }>("/patient/documents", input),
};
