import { Badge, Box, Flex, Spinner, Tabs } from "@radix-ui/themes";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { doctorApi } from "@/api/doctor";
import { useAuth } from "@/auth/AuthContext";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorCallout } from "@/components/ui/ErrorCallout";
import type { DoctorDashboard, DoctorPatient, RecordType } from "@/types/schema";
import { DoctorVisitsTable } from "./DoctorVisitsTable";
import { PatientsTable } from "./PatientsTable";
import { SharedRecordsTable } from "./SharedRecordsTable";
import { RatingBadge } from "@/components/ui/RatingBadge";

export function DoctorDashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [recordType, setRecordType] = useState<RecordType | null>(null);
  const [data, setData] = useState<DoctorDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<DoctorPatient[] | null>(null);

  const loadPatients = useCallback(async () => {
    setPatients((await doctorApi.patients()).patients);
  }, []);

  useEffect(() => {
    loadPatients().catch(() => setPatients([]));
  }, [loadPatients]);

  useEffect(() => {
    let cancelled = false;
    doctorApi
      .dashboard(recordType)
      .then((d) => !cancelled && setData(d))
      .catch(async (err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }
        setError(err instanceof ApiError ? err.message : "Couldn't load the doctor dashboard.");
      });
    return () => {
      cancelled = true;
    };
  }, [recordType, logout, navigate]);

  if (error) {
    return (
      <PageContainer title="Doctor portal">
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
    <PageContainer
      title={`Welcome, ${data.provider.provider_name}`}
      actions={
        <Flex gap="2" wrap="wrap" align="center">
          {data.specialities.map((s) => (
            <Badge key={s.speciality_id} size="2" variant="soft">
              {s.speciality_name}
            </Badge>
          ))}
          <RatingBadge rating={data.provider.rating} size="3" />
        </Flex>
      }
    >
      <Tabs.Root defaultValue="patients">
        <Tabs.List size="2">
          <Tabs.Trigger value="patients">Patients</Tabs.Trigger>
          <Tabs.Trigger value="shared">Shared with me ({data.shared_records.length})</Tabs.Trigger>
          <Tabs.Trigger value="visits">Visits ({data.visits.length})</Tabs.Trigger>
        </Tabs.List>
        <Box pt="4">
          <Tabs.Content value="patients">
            {patients === null ? (
              <Flex justify="center" py="6">
                <Spinner size="3" />
              </Flex>
            ) : (
              <PatientsTable patients={patients} onChanged={loadPatients} />
            )}
          </Tabs.Content>
          <Tabs.Content value="shared">
            <SharedRecordsTable records={data.shared_records} recordType={recordType} onRecordTypeChange={setRecordType} />
          </Tabs.Content>
          <Tabs.Content value="visits">
            <DoctorVisitsTable visits={data.visits} />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </PageContainer>
  );
}
