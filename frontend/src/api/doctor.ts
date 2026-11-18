import type { DoctorDashboard, DoctorPatient, DoctorPatientDetail, Provider, RecordType } from "@/types/schema";
import { del, get, post, put } from "./client";

type Ok = { ok: true };

export interface VisitInput {
  visit_date: string;
  facility_id: number;
}

export const doctorApi = {
  providers: () => get<{ providers: Provider[] }>("/doctor/providers"),
  dashboard: (recordType: RecordType | null) =>
    get<DoctorDashboard>(
      recordType ? `/doctor/dashboard?record_type=${encodeURIComponent(recordType)}` : "/doctor/dashboard",
    ),

  patients: () => get<{ patients: DoctorPatient[] }>("/doctor/patients"),
  patient: (uid: number) => get<DoctorPatientDetail>(`/doctor/patients/${uid}`),
  logVisit: (uid: number, input: VisitInput) => post<{ visit_id: number }>(`/doctor/patients/${uid}/visits`, input),
  editVisit: (visitId: number, input: VisitInput) => put<Ok>(`/doctor/visits/${visitId}`, input),
  createDocument: (uid: number, input: { record_type: RecordType; notes: string; file_link: string; provider_ids: number[] }) =>
    post<{ record_no: number }>(`/doctor/patients/${uid}/documents`, input),
  refer: (uid: number, input: { provider_id: number; reason: string; share_record_nos: number[] }) =>
    post<{ record_no: number }>(`/doctor/patients/${uid}/referrals`, input),
  /** Stop being their PCP and drop their shares to me; visits stay. */
  removePatient: (uid: number) => del<Ok>(`/doctor/patients/${uid}`),
};
