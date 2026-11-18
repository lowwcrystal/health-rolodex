import { IdCardIcon, PersonIcon } from "@radix-ui/react-icons";
import { Box, Button, Flex, Spinner, Tabs, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { patientApi } from "@/api/patient";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorCallout } from "@/components/ui/ErrorCallout";
import type { EmergencyInfo, Profile } from "@/types/schema";
import { MedicalIdCard, MedicalInfoGrid } from "./MedicalInfo";
import { ProfileCard } from "./ProfileCard";

/** Patient account, in two parts: the profile (users; password_hash is never sent) and a printable medical ID card. */
export function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [medical, setMedical] = useState<EmergencyInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([patientApi.dashboard(), patientApi.emergency()])
      .then(([d, e]) => {
        setProfile(d.profile);
        setMedical(e);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load your account."));
  }, []);

  return (
    <PageContainer backTo="/dashboard" title="Account" subtitle="Your profile and your medical ID card.">
      {error ? (
        <ErrorCallout message={error} />
      ) : !profile || !medical ? (
        <Flex justify="center" py="9">
          <Spinner size="3" />
        </Flex>
      ) : (
        <Tabs.Root defaultValue="profile">
          <Tabs.List size="2" className="no-print">
            <Tabs.Trigger value="profile">
              <Flex gap="2" align="center">
                <PersonIcon /> Profile
              </Flex>
            </Tabs.Trigger>
            <Tabs.Trigger value="medical">
              <Flex gap="2" align="center">
                <IdCardIcon /> Medical ID card
              </Flex>
            </Tabs.Trigger>
          </Tabs.List>

          <Box pt="4">
            <Tabs.Content value="profile">
              <div style={{ maxWidth: 560 }}>
                <ProfileCard profile={profile} />
              </div>
            </Tabs.Content>

            <Tabs.Content value="medical">
              <Flex direction="column" gap="4">
                <Flex justify="between" align="center" gap="3" wrap="wrap" className="no-print">
                  <Text size="2" color="gray">
                    Show this to a first responder or care team.
                  </Text>
                  <Button variant="soft" onClick={() => window.print()}>
                    Print card
                  </Button>
                </Flex>
                <MedicalIdCard data={medical} />
                <MedicalInfoGrid data={medical} />
              </Flex>
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      )}
    </PageContainer>
  );
}
