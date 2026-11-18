import type { CareSites, CareTeam, CareTeamUpdate, EmergencyInfo, Inbox, PatientDashboard, RelationType } from "@/types/schema";
import { del, get, post, put } from "./client";

type Ok = { ok: true };
export interface EnrollmentInput {
  start_date: string;
  /** "" = no end date (stored as NULL). */
  expiration_date: string;
}

/** My row in relationto: what they are to me, and the two flags. */
export interface RelationInput {
  relation_type: RelationType;
  is_emergency_contact: boolean;
  is_guardian: boolean;
}

export const patientApi = {
  dashboard: () => get<PatientDashboard>("/patient/dashboard"),
  emergency: () => get<EmergencyInfo>("/patient/emergency"),
  careSites: () => get<CareSites>("/patient/care-sites"),
  /** Keys left out stay unchanged; null removes the PCP/pharmacy. */
  updateCareTeam: (body: CareTeamUpdate) => put<CareTeam>("/patient/care-team", body),

  // enrolledin
  addPlan: (plan_id: number, dates: EnrollmentInput) => post<Ok>("/patient/plans", { plan_id, ...dates }),
  editPlan: (plan_id: number, dates: EnrollmentInput) => put<Ok>(`/patient/plans/${plan_id}`, dates),
  removePlan: (plan_id: number) => del<Ok>(`/patient/plans/${plan_id}`),

  // diagnosed
  addCondition: (condition_id: number, diagnosed_date: string) => post<Ok>("/patient/conditions", { condition_id, diagnosed_date }),
  editCondition: (condition_id: number, diagnosed_date: string) => put<Ok>(`/patient/conditions/${condition_id}`, { diagnosed_date }),
  removeCondition: (condition_id: number) => del<Ok>(`/patient/conditions/${condition_id}`),

  // relationto: pending = only my row; confirmed = both rows
  inbox: () => get<Inbox>("/patient/inbox"),
  addRelative: (email: string, fields: RelationInput) =>
    post<{ relative_id: number; confirmed: boolean }>("/patient/family", { email, ...fields }),
  editRelative: (relative_id: number, fields: RelationInput) => put<Ok>(`/patient/family/${relative_id}`, fields),
  /** Unlinks both ways (also cancels a request I sent). */
  removeRelative: (relative_id: number) => del<Ok>(`/patient/family/${relative_id}`),
  acceptRequest: (requester_id: number, fields: RelationInput) =>
    post<Ok>(`/patient/family/requests/${requester_id}/accept`, fields),
  declineRequest: (requester_id: number) => del<Ok>(`/patient/family/requests/${requester_id}`),
};
