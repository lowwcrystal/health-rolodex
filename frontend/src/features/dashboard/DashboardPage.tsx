import { Flex, Spinner } from "@radix-ui/themes";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { patientApi } from "@/api/patient";
import { useAuth } from "@/auth/AuthContext";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorCallout } from "@/components/ui/ErrorCallout";
import type { PatientDashboard } from "@/types/schema";
import { CareTeamCard } from "./CareTeamCard";
import { ConditionsCard } from "./ConditionsCard";
import { FamilyCard } from "./FamilyCard";
import { HealthPatternsCard } from "./HealthPatternsCard";
import { InsuranceCard } from "./InsuranceCard";
import { RecommendedDoctorsCard } from "./RecommendedDoctorsCard";
import { RecordsTable } from "./RecordsTable";
import { VisitsTable } from "./VisitsTable";
import { notifyInboxChanged } from "@/features/inbox/inboxEvents";

export function DashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<PatientDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Re-read everything after an edit, so insights and recommendations update too. */
  const reload = useCallback(async () => {
    setData(await patientApi.dashboard());
    notifyInboxChanged();
  }, []);

  useEffect(() => {
    patientApi
      .dashboard()
      .then(setData)
      .catch(async (err) => {
        if (err instanceof ApiError && err.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }
        setError(err instanceof ApiError ? err.message : "Couldn't load your dashboard.");
      });
  }, [logout, navigate]);

  if (error) {
    return (
      <PageContainer title="Your dashboard">
        <ErrorCallout message={error} />
      </PageContainer>
    );
  }
  if (!data) {
    return (
      <Flex justify="center" py="9">
        <Spinner size="3" />
      </Flex>
    );
  }

  return (
    <PageContainer title={`Welcome ${data.profile.first_name}!`} subtitle="Here's everything in your health rolodex.">
      <Flex direction="column" gap="4">
        <HealthPatternsCard insights={data.insights} />
        <RecommendedDoctorsCard doctors={data.recommended_doctors} />
        <div className="dashboard-grid">
          <CareTeamCard profile={data.profile} visits={data.visits} onChanged={reload} />
          <InsuranceCard plans={data.plans} facilities={data.in_network_facilities} onChanged={reload} />
          <ConditionsCard conditions={data.conditions} onChanged={reload} />
          <FamilyCard family={data.family} requests={data.family_requests} onChanged={reload} />
          <VisitsTable visits={data.visits} />
          <RecordsTable records={data.records} />
        </div>
      </Flex>
    </PageContainer>
  );
}
