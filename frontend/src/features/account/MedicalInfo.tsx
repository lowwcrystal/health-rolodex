import { ExclamationTriangleIcon, HeartIcon, IdCardIcon, PersonIcon } from "@radix-ui/react-icons";
import { Badge, Box, Card, DataList, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { capitalize, formatDate } from "@/components/ui/format";
import type { EmergencyInfo } from "@/types/schema";

function Block({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card size="3" className="emergency-block">
      <Flex align="center" gap="2" mb="3">
        <span className="icon-tile">{icon}</span>
        <Heading as="h2" size="4">
          {title}
        </Heading>
      </Flex>
      {children}
    </Card>
  );
}

function ageFrom(dob: string): number {
  const [y, m, d] = dob.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}

/** The Medical ID header: what a first responder needs first. */
export function MedicalIdCard({ data }: { data: EmergencyInfo }) {
  const p = data.person;
  const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
  return (
    <Card size="4" className="surface-tint">
      <Text as="div" size="1" color="indigo" weight="bold">
        MEDICAL ID
      </Text>
      <Heading size="8" mt="1">
        {fullName}
      </Heading>
      <Text as="div" size="3" color="gray" mt="1">
        Born {formatDate(p.dob)} · {ageFrom(p.dob)} years old{p.gender ? ` · ${capitalize(p.gender)}` : ""}
      </Text>
    </Card>
  );
}

/** Allergies, conditions, emergency contacts, and care team & insurance (from /api/patient/emergency). */
export function MedicalInfoGrid({ data }: { data: EmergencyInfo }) {
  const p = data.person;
  return (
    <Grid columns={{ initial: "1", md: "2" }} gap="4">
      <Block title="Allergies" icon={<ExclamationTriangleIcon />}>
        {data.allergies.length === 0 ? (
          <EmptyState message="No known allergies on file." />
        ) : (
          <Flex gap="2" wrap="wrap">
            {data.allergies.map((a) => (
              <Badge key={a.condition_name} color="red" size="3">
                {a.condition_name}
              </Badge>
            ))}
          </Flex>
        )}
      </Block>

      <Block title="Conditions" icon={<HeartIcon />}>
        {data.conditions.length === 0 ? (
          <EmptyState message="No conditions on file." />
        ) : (
          <Flex direction="column" gap="2">
            {data.conditions.map((c) => (
              <Flex key={c.condition_name} justify="between" gap="2">
                <Text weight="medium">{c.condition_name}</Text>
                <Text size="2" color="gray">
                  {capitalize(c.category)} · since {formatDate(c.diagnosed_date)}
                </Text>
              </Flex>
            ))}
          </Flex>
        )}
      </Block>

      <Block title="Emergency contacts" icon={<PersonIcon />}>
        {data.contacts.length === 0 ? (
          <EmptyState message="No emergency contacts added." />
        ) : (
          <Flex direction="column" gap="3">
            {data.contacts.map((c) => (
              <Box key={c.email}>
                <Flex align="center" gap="2" wrap="wrap">
                  <Text weight="medium">
                    {c.first_name} {c.last_name}
                  </Text>
                  <Text size="2" color="gray">
                    {capitalize(c.relation_type)}
                  </Text>
                  {c.is_guardian && <Badge variant="soft">Guardian</Badge>}
                </Flex>
                <Text as="div" size="2">
                  {c.email}
                </Text>
              </Box>
            ))}
          </Flex>
        )}
      </Block>

      <Block title="Care team & insurance" icon={<IdCardIcon />}>
        <DataList.Root>
          <DataList.Item>
            <DataList.Label>Primary care</DataList.Label>
            <DataList.Value>{p.pcp_name ?? "—"}</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Pharmacy</DataList.Label>
            <DataList.Value>{p.pharmacy_name ? `${p.pharmacy_name}, ${p.pharmacy_address}` : "—"}</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Insurance</DataList.Label>
            <DataList.Value>
              {data.insurance.length === 0
                ? "No active plan"
                : data.insurance
                    .map((i) => `${i.plan_name} (${i.plan_type}${i.plan_holder ? `, ${i.plan_holder}` : ""})`)
                    .join("; ")}
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      </Block>
    </Grid>
  );
}
