import { Button, Flex, Grid, Link, Separator, Text } from "@radix-ui/themes";
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, Link as RouterLink, useNavigate } from "react-router-dom";
import { authApi, type SignupInput } from "@/api/auth";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { ErrorCallout } from "@/components/ui/ErrorCallout";
import { FormField } from "@/components/ui/FormField";
import { todayISO, providerOptionLabel } from "@/components/ui/format";
import { MAX_LEN, PASSWORD_MAX, PASSWORD_MIN, type Pharmacy, type Provider } from "@/types/schema";
import { AuthCard } from "./AuthCard";
import { OptionSelect } from "@/components/ui/OptionSelect";
import { validateSignup, type FieldErrors, type SignupField } from "./validation";

const EMPTY: SignupInput = {
  username: "",
  email: "",
  password: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  dob: "",
  gender: "",
  pcp_provider_id: null,
  pharmacy_id: null,
};

// users.gender is free text (varchar(20)); offer common choices, plus "self-describe".
const GENDER_OPTIONS = [
  { value: "Female", label: "Female" },
  { value: "Male", label: "Male" },
  { value: "Non-binary", label: "Non-binary" },
  { value: "__other", label: "Self-describe" },
];

export function SignupPage() {
  const { session, signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<SignupInput>(EMPTY);
  const [genderChoice, setGenderChoice] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors<SignupField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);

  useEffect(() => {
    authApi
      .options()
      .then((o) => {
        setProviders(o.providers);
        setPharmacies(o.pharmacies);
      })
      .catch(() => undefined); // the dropdowns are optional; signup still works without them
  }, []);

  if (session?.role === "patient") return <Navigate to="/dashboard" replace />;

  const set = <K extends keyof SignupInput>(key: K) => (value: SignupInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onGender = (choice: string | null) => {
    setGenderChoice(choice);
    set("gender")(choice && choice !== "__other" ? choice : "");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateSignup(form);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      await signup({ ...form, email: form.email.trim() });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      size="2"
      title="Create your health rolodex"
      subtitle="Start with the basics. You can add plans, records and family later."
      footer={
        <>
          Already have an account?{" "}
          <Link asChild>
            <RouterLink to="/login">Log in</RouterLink>
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <Flex direction="column" gap="4">
          <ErrorCallout message={formError} />

          <Text size="2" weight="bold" color="indigo">
            ACCOUNT
          </Text>
          <Grid columns={{ initial: "1", sm: "2" }} gap="4">
            <FormField id="username" label="Username" autoComplete="username" maxLength={MAX_LEN.username}
              value={form.username} onChange={set("username")} error={errors.username} />
            <FormField id="email" label="Email" type="email" autoComplete="email" maxLength={MAX_LEN.email}
              value={form.email} onChange={set("email")} error={errors.email} />
          </Grid>
          <FormField id="password" label="Password" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX}
            value={form.password} onChange={set("password")} error={errors.password}
            hint={`At least ${PASSWORD_MIN} characters.`} />

          <Separator size="4" my="1" />
          <Text size="2" weight="bold" color="indigo">
            ABOUT YOU
          </Text>
          <Grid columns={{ initial: "1", sm: "3" }} gap="4">
            <FormField id="first_name" label="First name" autoComplete="given-name" maxLength={MAX_LEN.first_name}
              value={form.first_name} onChange={set("first_name")} error={errors.first_name} />
            <FormField id="middle_name" label="Middle name" optional autoComplete="additional-name" maxLength={MAX_LEN.middle_name}
              value={form.middle_name} onChange={set("middle_name")} error={errors.middle_name} />
            <FormField id="last_name" label="Last name" autoComplete="family-name" maxLength={MAX_LEN.last_name}
              value={form.last_name} onChange={set("last_name")} error={errors.last_name} />
          </Grid>
          <Grid columns={{ initial: "1", sm: "2" }} gap="4">
            <FormField id="dob" label="Date of birth" type="date" max={todayISO()} autoComplete="bday"
              value={form.dob} onChange={set("dob")} error={errors.dob} />
            <Flex direction="column" gap="2">
              <OptionSelect id="gender" label="Gender" placeholder="Prefer not to say" value={genderChoice}
                options={GENDER_OPTIONS} onChange={onGender} />
              {genderChoice === "__other" && (
                <FormField id="gender_custom" label="Describe your gender" maxLength={MAX_LEN.gender}
                  value={form.gender} onChange={set("gender")} error={errors.gender} />
              )}
            </Flex>
          </Grid>

          <Separator size="4" my="1" />
          <Text size="2" weight="bold" color="indigo">
            CARE TEAM (OPTIONAL)
          </Text>
          <Grid columns={{ initial: "1", sm: "2" }} gap="4">
            <OptionSelect id="pcp" label="Primary care provider" placeholder="None yet"
              value={form.pcp_provider_id === null ? null : String(form.pcp_provider_id)}
              options={providers.map((p) => ({
                value: String(p.provider_id),
                label: providerOptionLabel(p),
              }))}
              onChange={(v) => set("pcp_provider_id")(v === null ? null : Number(v))} />
            <OptionSelect id="pharmacy" label="Pharmacy" placeholder="None yet"
              value={form.pharmacy_id === null ? null : String(form.pharmacy_id)}
              options={pharmacies.map((p) => ({ value: String(p.pharmacy_id), label: `${p.pharmacy_name} · ${p.address}` }))}
              onChange={(v) => set("pharmacy_id")(v === null ? null : Number(v))} />
          </Grid>

          <Button type="submit" size="3" mt="2" loading={submitting}>
            Create account
          </Button>
        </Flex>
      </form>
    </AuthCard>
  );
}
