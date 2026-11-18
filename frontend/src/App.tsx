import { Flex, Spinner } from "@radix-ui/themes";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./features/auth/LoginPage";
import { SignupPage } from "./features/auth/SignupPage";
import { AccountPage } from "./features/account/AccountPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { DocumentsPage } from "./features/documents/DocumentsPage";
import { InboxPage } from "./features/inbox/InboxPage";
import { DoctorDashboardPage } from "./features/doctor/DoctorDashboardPage";
import { DoctorPatientPage } from "./features/doctor/DoctorPatientPage";
import { LandingPage } from "./features/landing/LandingPage";

// mapbox-gl is large, so the Emergency Site finder loads only when opened.
const EmergencyPage = lazy(() => import("./features/emergency/EmergencyPage").then((m) => ({ default: m.EmergencyPage })));
const pageSpinner = (
  <Flex justify="center" py="9">
    <Spinner size="3" />
  </Flex>
);

/** Route table only. Keep these paths in sync with the `spa` routes in server.py. */
export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth role="patient">
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/account"
          element={
            <RequireAuth role="patient">
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route
          path="/inbox"
          element={
            <RequireAuth role="patient">
              <InboxPage />
            </RequireAuth>
          }
        />
        <Route
          path="/documents"
          element={
            <RequireAuth role="patient">
              <DocumentsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/emergency"
          element={
            <RequireAuth role="patient">
              <Suspense fallback={pageSpinner}>
                <EmergencyPage />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route path="/doctor" element={<Navigate to="/login" replace />} />
        <Route
          path="/doctor/patients/:id"
          element={
            <RequireAuth role="doctor">
              <DoctorPatientPage />
            </RequireAuth>
          }
        />
        <Route
          path="/doctor/dashboard"
          element={
            <RequireAuth role="doctor">
              <DoctorDashboardPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
