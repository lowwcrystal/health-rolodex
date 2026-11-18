import type { Category, InsurancePlanRow, Pharmacy, Provider, PublicUser } from "@/types/schema";
import { get, post } from "./client";

export type Session =
  | { role: "patient"; user: PublicUser }
  | { role: "doctor"; provider: Provider };

export interface LoginInput {
  email: string;
  password: string;
}

/** Fields map 1:1 to the `users` columns (password becomes password_hash on the server). */
export interface SignupInput {
  username: string;
  email: string;
  password: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  dob: string;
  gender: string;
  pcp_provider_id: number | null;
  pharmacy_id: number | null;
}

/** Reference rows for dropdowns (GET /api/options). */
export interface Options {
  providers: Provider[];
  pharmacies: Pharmacy[];
  plans: InsurancePlanRow[];
  conditions: { condition_id: number; condition_name: string; category: Category }[];
  facilities: { facility_id: number; facility_name: string; address: string }[];
  specialities: { speciality_id: number; speciality_name: string; provider_ids: number[] }[];
}

export const authApi = {
  me: () => get<Session>("/auth/me"),
  login: (input: LoginInput) => post<Session>("/auth/login", input),
  signup: (input: SignupInput) => post<Session>("/auth/signup", input),
  logout: () => post<{ ok: true }>("/auth/logout"),
  options: () => get<Options>("/options"),
};
