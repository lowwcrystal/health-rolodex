import { Flex, Spinner } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

interface Props {
  role: "patient" | "doctor";
  children: ReactNode;
}

/** Route guard: send people without the right session (patient or doctor) to the shared login page. */
export function RequireAuth({ role, children }: Props) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Flex justify="center" py="9">
        <Spinner size="3" />
      </Flex>
    );
  }
  if (session?.role !== role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
