/** Client-side checks that mirror schema_rules.py / SCHEMA.md §6. The server checks everything again. */
import type { SignupInput } from "@/api/auth";
import { MAX_LEN, PASSWORD_MAX, PASSWORD_MIN } from "@/types/schema";
import { todayISO } from "@/components/ui/format";

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type SignupField = keyof SignupInput;

function checkText(errors: FieldErrors<SignupField>, field: keyof typeof MAX_LEN, value: string, label: string, required: boolean) {
  const v = value.trim();
  if (!v) {
    if (required) errors[field] = `${label} is required.`;
    return;
  }
  if (v.length > MAX_LEN[field]) errors[field] = `${label} must be at most ${MAX_LEN[field]} characters.`;
}

export function validateSignup(input: SignupInput): FieldErrors<SignupField> {
  const errors: FieldErrors<SignupField> = {};
  checkText(errors, "username", input.username, "Username", true);
  checkText(errors, "email", input.email, "Email", true);
  if (!errors.email && !input.email.includes("@")) errors.email = "Enter a valid email address.";
  checkText(errors, "first_name", input.first_name, "First name", true);
  checkText(errors, "middle_name", input.middle_name, "Middle name", false);
  checkText(errors, "last_name", input.last_name, "Last name", true);
  checkText(errors, "gender", input.gender, "Gender", false);
  if (!input.dob) errors.dob = "Date of birth is required.";
  else if (input.dob > todayISO()) errors.dob = "Date of birth can't be in the future.";
  if (input.password.length < PASSWORD_MIN || input.password.length > PASSWORD_MAX) {
    errors.password = `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`;
  }
  return errors;
}

export function validateLogin(email: string, password: string): FieldErrors<"email" | "password"> {
  const errors: FieldErrors<"email" | "password"> = {};
  if (!email.trim()) errors.email = "Email is required.";
  else if (!email.includes("@")) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  return errors;
}
