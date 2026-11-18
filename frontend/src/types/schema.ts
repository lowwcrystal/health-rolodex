/**
 * TypeScript mirror of SCHEMA.md. It's the only frontend file that defines schema shapes and allowed values.
 * Keep it in sync with SCHEMA.md and ../../schema_rules.py.
 * Dates arrive as ISO strings (YYYY-MM-DD).
 */

// SCHEMA.md §5: the CHECK constraint values
export const CATEGORIES = ["allergy", "chronic", "genetic"] as const;
export const RECORD_TYPES = [
  "lab_result",
  "imaging",
  "prescription",
  "visit_summary",
  "immunization",
  "other",
] as const;
export const RELATION_TYPES = ["parent", "child", "sibling", "spouse", "guardian", "other"] as const;

export type Category = (typeof CATEGORIES)[number];
export type RecordType = (typeof RECORD_TYPES)[number];
export type RelationType = (typeof RELATION_TYPES)[number];

// SCHEMA.md §6.2: varchar limits for the user-entered fields used in the UI
export const MAX_LEN = {
  username: 30,
  email: 100,
  gender: 20,
  first_name: 30,
  middle_name: 30,
  last_name: 30,
} as const;

/** records.file_link varchar(255) */
export const MAX_LEN_FILE_LINK = 255;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export type ISODate = string;

/** Public fields of `users` (password_hash is never sent to the client). */
export interface PublicUser {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Provider {
  provider_id: number;
  provider_name: string;
  /** provider.rating numeric(2,1), 1.0–5.0, nullable (CHECK valid_rating) */
  rating?: number | null;
  specialities?: string;
}

export interface Pharmacy {
  pharmacy_id: number;
  pharmacy_name: string;
  address: string;
}

/** users ⋈ provider (PCP) ⋈ pharmacy */
export interface Profile {
  user_id: number;
  username: string;
  email: string;
  gender: string | null;
  dob: ISODate;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  pcp_provider_id: number | null;
  pcp_name: string | null;
  pcp_rating: number | null;
  pcp_specialities: string | null;
  pharmacy_id: number | null;
  pharmacy_name: string | null;
  pharmacy_address: string | null;
}

/** enrolledin ⋈ insuranceplan */
export interface Enrollment {
  plan_id: number;
  plan_name: string;
  plan_type: string;
  plan_holder: string | null;
  start_date: ISODate;
  expiration_date: ISODate | null;
  is_active: boolean;
}

/** facility ⋈ accepts ⋈ the user's active enrolledin */
export interface InNetworkFacility {
  facility_id: number;
  facility_name: string;
  address: string;
  via_plans: string;
}

/** diagnosed ⋈ condition (+ recommends → speciality) */
export interface Diagnosis {
  condition_id: number;
  condition_name: string;
  category: Category;
  diagnosed_date: ISODate;
  recommended_specialities: string;
}

/** visit ⋈ provider ⋈ facility */
export interface Visit {
  visit_id: number;
  visit_date: ISODate;
  provider_id: number;
  provider_name: string;
  facility_id: number;
  facility_name: string;
  facility_address: string;
}

/** records (+ sharedwith → provider) */
export interface HealthRecord {
  record_no: number;
  record_type: RecordType;
  is_shareable: boolean;
  notes: string | null;
  file_link: string | null;
  upload_date: ISODate;
  shared_with: Pick<Provider, "provider_id" | "provider_name">[];
}

/** relationto ⋈ users (relative) */
export interface Relative {
  relative_id: number;
  first_name: string;
  last_name: string;
  relation_type: RelationType;
  is_emergency_contact: boolean;
  is_guardian: boolean;
  /** Both relationto rows exist (they accepted). Pending = only my row. */
  confirmed: boolean;
  /** Only sent once confirmed. */
  email: string | null;
}

/** Someone added me (X -> me) and I haven't answered. relation_type = what they say I am to them. */
export interface FamilyRequest {
  user_id: number;
  first_name: string;
  last_name: string;
  relation_type: RelationType;
}

export interface Inbox {
  requests: FamilyRequest[];
  sent: (FamilyRequest & { is_emergency_contact: boolean; is_guardian: boolean })[];
  /** records ⋈ sharedwith ⋈ provider: my documents shared with doctors */
  shares: {
    record_no: number;
    record_type: RecordType;
    notes: string | null;
    upload_date: ISODate;
    provider_id: number;
    provider_name: string;
  }[];
}

export const RELATION_LABELS: Record<RelationType, string> = {
  parent: "Parent",
  child: "Child",
  sibling: "Sibling",
  spouse: "Spouse",
  guardian: "Guardian",
  other: "Other",
};

/** Rule-based health pattern (api/insights.py) */
export interface Insight {
  level: "info" | "attention";
  title: string;
  detail: string;
}

/** diagnosed → recommends → specializesin → provider */
export interface RecommendedDoctor {
  provider_id: number;
  provider_name: string;
  rating: number | null;
  specialities: string;
  for_conditions: string;
  matched_conditions: number;
  seen_before: boolean;
  is_pcp: boolean;
}

export interface CareGap {
  condition_name: string;
  speciality_name: string;
}

export interface EmergencyInfo {
  person: {
    first_name: string;
    middle_name: string | null;
    last_name: string;
    dob: ISODate;
    gender: string | null;
    pcp_name: string | null;
    pharmacy_name: string | null;
    pharmacy_address: string | null;
  };
  allergies: { condition_name: string; category: Category; diagnosed_date: ISODate }[];
  conditions: { condition_name: string; category: Category; diagnosed_date: ISODate }[];
  contacts: {
    first_name: string;
    last_name: string;
    email: string;
    relation_type: RelationType;
    is_emergency_contact: boolean;
    is_guardian: boolean;
  }[];
  insurance: { plan_name: string; plan_type: string; plan_holder: string | null; expiration_date: ISODate | null }[];
}

export interface PatientDashboard {
  insights: Insight[];
  recommended_doctors: RecommendedDoctor[];
  care_gaps: CareGap[];
  profile: Profile;
  plans: Enrollment[];
  in_network_facilities: InNetworkFacility[];
  conditions: Diagnosis[];
  visits: Visit[];
  records: HealthRecord[];
  family: Relative[];
  family_requests: FamilyRequest[];
}

/** sharedwith ⋈ records ⋈ users */
export interface SharedRecord {
  record_no: number;
  user_id: number;
  first_name: string;
  last_name: string;
  dob: ISODate;
  record_type: RecordType;
  upload_date: ISODate;
  notes: string | null;
  file_link: string | null;
}

export interface DoctorVisit {
  visit_id: number;
  visit_date: ISODate;
  user_id: number;
  first_name: string;
  last_name: string;
  facility_id: number;
  facility_name: string;
}

export interface DoctorDashboard {
  provider: Provider & { pcp_patient_count: number };
  specialities: { speciality_id: number; speciality_name: string }[];
  shared_records: SharedRecord[];
  visits: DoctorVisit[];
  record_type_filter: RecordType | null;
}

/** Labels for display only; the raw values above are what get stored. */
export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  lab_result: "Lab result",
  imaging: "Imaging",
  prescription: "Prescription",
  visit_summary: "Visit summary",
  immunization: "Immunization",
  other: "Other",
};

/**
 * Document kinds for "My Documents". Mirrors schema_rules.DOCUMENT_KINDS (SCHEMA.md §6.6).
 * Cards and ID are stored as record_type "other" with a notes prefix, as two records rows (front, back).
 */
export const DOCUMENT_KINDS = {
  lab_result: { label: "Lab result", recordType: "lab_result", twoSided: false, prefix: null },
  imaging: { label: "Imaging", recordType: "imaging", twoSided: false, prefix: null },
  prescription: { label: "Prescription", recordType: "prescription", twoSided: false, prefix: null },
  visit_summary: { label: "Visit summary", recordType: "visit_summary", twoSided: false, prefix: null },
  immunization: { label: "Immunization", recordType: "immunization", twoSided: false, prefix: null },
  insurance_card: { label: "Insurance card", recordType: "other", twoSided: true, prefix: "Insurance card" },
  photo_id: { label: "Photo ID", recordType: "other", twoSided: true, prefix: "Photo ID" },
  pharmacy_card: { label: "Pharmacy card", recordType: "other", twoSided: true, prefix: "Pharmacy card" },
  other: { label: "Other", recordType: "other", twoSided: false, prefix: null },
} as const satisfies Record<string, { label: string; recordType: RecordType; twoSided: boolean; prefix: string | null }>;

export type DocumentKind = keyof typeof DOCUMENT_KINDS;
export const DOCUMENT_KIND_KEYS = Object.keys(DOCUMENT_KINDS) as DocumentKind[];

export type DocumentSide = "front" | "back" | null;

export interface ParsedDocument {
  kind: DocumentKind;
  side: DocumentSide;
  notes: string | null;
}

const PREFIX_TO_KIND = new Map<string, DocumentKind>(
  DOCUMENT_KIND_KEYS.flatMap((k) => {
    const prefix = DOCUMENT_KINDS[k].prefix;
    return prefix ? [[prefix, k] as [string, DocumentKind]] : [];
  }),
);

/** Recover the kind and side from a record's notes ("Insurance card (front): …"). Otherwise use the record_type. */
export function parseDocumentKind(recordType: RecordType, notes: string | null): ParsedDocument {
  const match = notes?.match(/^(Insurance card|Photo ID|Pharmacy card)(?: \((front|back)\))?(?::\s?([\s\S]*))?$/);
  if (match && PREFIX_TO_KIND.has(match[1])) {
    return { kind: PREFIX_TO_KIND.get(match[1])!, side: (match[2] as DocumentSide) ?? null, notes: match[3] || null };
  }
  return { kind: recordType, side: null, notes };
}

/** The longest notes text the user can type for a kind (500 minus the "<Kind> (front): " prefix). */
export function maxNotesLength(kind: DocumentKind): number {
  const prefix = DOCUMENT_KINDS[kind].prefix;
  return prefix ? 500 - `${prefix} (front): `.length : 500;
}

/** users.pcp_provider_id / users.pharmacy_id with their joined names (PUT /api/patient/care-team response). */
export type CareTeam = Pick<
  Profile,
  "pcp_provider_id" | "pcp_name" | "pcp_rating" | "pcp_specialities" | "pharmacy_id" | "pharmacy_name" | "pharmacy_address"
>;
export interface CareTeamUpdate {
  pcp_provider_id?: number | null;
  pharmacy_id?: number | null;
}

/** facility ⋈ accepts ⋈ insuranceplan, plus the user's active-plan match and visits (GET /api/patient/care-sites). */
export interface CareFacility {
  facility_id: number;
  facility_name: string;
  address: string;
  accepted_plans: Pick<InsurancePlanRow, "plan_id" | "plan_name" | "plan_type" | "plan_holder">[];
  in_network: boolean;
  my_visits: number;
  last_visit: ISODate | null;
}
export interface InsurancePlanRow {
  plan_id: number;
  plan_name: string;
  plan_type: string;
  plan_holder: string | null;
}
export interface CarePlan extends InsurancePlanRow {
  is_mine: boolean;
  is_mine_active: boolean;
}
export interface CareSites {
  facilities: CareFacility[];
  plans: CarePlan[];
}

/** A patient linked to the selected doctor: PCP, a visit, or a document shared with them (GET /api/doctor/patients). */
export interface DoctorPatient {
  user_id: number;
  first_name: string;
  last_name: string;
  dob: ISODate;
  gender: string | null;
  is_pcp: boolean;
  visit_count: number;
  last_seen: ISODate | null;
  shared_count: number;
}

/** GET /api/doctor/patients/:id (only documents shared with this doctor; never password_hash). */
export interface DoctorPatientDetail {
  profile: {
    user_id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    dob: ISODate;
    gender: string | null;
    email: string;
    is_pcp: boolean;
  };
  conditions: Diagnosis[];
  visits: { visit_id: number; visit_date: ISODate; facility_id: number; facility_name: string }[];
  documents: { record_no: number; record_type: RecordType; notes: string | null; file_link: string | null; upload_date: ISODate }[];
  recommended_specialities: { speciality_id: number; speciality_name: string }[];
}
