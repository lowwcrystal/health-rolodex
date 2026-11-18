import { Button, Flex, Link } from "@radix-ui/themes";
import { useState, type FormEvent } from "react";
import { Navigate, Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { ErrorCallout } from "@/components/ui/ErrorCallout";
import { FormField } from "@/components/ui/FormField";
import { MAX_LEN } from "@/types/schema";
import { AuthCard } from "./AuthCard";
import { validateLogin, type FieldErrors } from "./validation";

const home = (role: "patient" | "doctor") => (role === "doctor" ? "/doctor/dashboard" : "/dashboard");

/** One login for both roles: a patient email opens the patient dashboard, a provider email the doctor dashboard. */
export function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"email" | "password">>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Navigate to={home(session.role)} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateLogin(email, password);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      const next = await login({ email: email.trim(), password });
      // Go back where they came from only if that page belongs to the role they logged in as.
      const from = (location.state as { from?: string } | null)?.from;
      const fromDoctorArea = !!from && from.startsWith("/doctor");
      const ok = from && from !== "/login" && fromDoctorArea === (next.role === "doctor");
      navigate(ok ? from : home(next.role), { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      centered
      title="Welcome back"
      subtitle="Patients and doctors both log in here with their email."
      footer={
        <>
          New here?{" "}
          <Link asChild>
            <RouterLink to="/signup">Create an account</RouterLink>
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <Flex direction="column" gap="4">
          <ErrorCallout message={formError} />
          <FormField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            maxLength={MAX_LEN.email}
            value={email}
            onChange={setEmail}
            error={errors.email}
            autoFocus
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            error={errors.password}
          />
          <Button type="submit" size="3" loading={submitting}>
            Log in
          </Button>
        </Flex>
      </form>
    </AuthCard>
  );
}
