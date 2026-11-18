import { IdCardIcon, Pencil1Icon, PlusIcon } from "@radix-ui/react-icons";
import { Badge, Box, Button, Flex, Grid, Text } from "@radix-ui/themes";
import { useState } from "react";
import { patientApi } from "@/api/patient";
import { useOptions } from "@/api/useOptions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormDialog } from "@/components/ui/FormDialog";
import { FormField } from "@/components/ui/FormField";
import { OptionSelect } from "@/components/ui/OptionSelect";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDate, todayISO } from "@/components/ui/format";
import type { Enrollment, InNetworkFacility } from "@/types/schema";
import { SubPanel } from "./CareTeamCard";

/** valid_enrollment_dates: expiration empty, or later than start. */
function datesError(start: string, expiration: string): string | null {
  if (!start) return "Start date is required.";
  if (expiration && expiration <= start) return "Expiration date must be after the start date.";
  return null;
}

function DateFields({ start, expiration, onStart, onExpiration }: {
  start: string; expiration: string; onStart: (v: string) => void; onExpiration: (v: string) => void;
}) {
  const error = start && expiration ? datesError(start, expiration) : null;
  return (
    <Grid columns="2" gap="3">
      <FormField id="start_date" label="Start date" type="date" required value={start} onChange={onStart} />
      <FormField id="expiration_date" label="Expiration date" type="date" optional value={expiration} onChange={onExpiration}
        min={start || undefined} error={error ?? undefined} hint="Leave empty if it doesn't expire." />
    </Grid>
  );
}

function AddPlanDialog({ enrolledIds, onSaved }: { enrolledIds: Set<number>; onSaved: () => Promise<void> }) {
  const options = useOptions();
  const [planId, setPlanId] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [expiration, setExpiration] = useState("");
  const available = (options?.plans ?? []).filter((p) => !enrolledIds.has(p.plan_id));

  return (
    <FormDialog
      title="Add insurance plan"
      trigger={
        <Button size="1" variant="soft">
          <PlusIcon /> Add plan
        </Button>
      }
      submitLabel="Add plan"
      onOpen={() => {
        setPlanId(null);
        setStart(todayISO());
        setExpiration("");
      }}
      canSubmit={planId !== null && !datesError(start, expiration)}
      onSubmit={async () => {
        await patientApi.addPlan(Number(planId), { start_date: start, expiration_date: expiration });
        await onSaved();
      }}
    >
      <OptionSelect id="plan" label="Plan" placeholder={options ? "Select a plan…" : "Loading…"} value={planId}
        options={available.map((p) => ({ value: String(p.plan_id), label: `${p.plan_name} · ${p.plan_type}` }))}
        onChange={setPlanId} />
      <DateFields start={start} expiration={expiration} onStart={setStart} onExpiration={setExpiration} />
    </FormDialog>
  );
}

function EditPlanDialog({ plan, onSaved }: { plan: Enrollment; onSaved: () => Promise<void> }) {
  const [start, setStart] = useState(plan.start_date);
  const [expiration, setExpiration] = useState(plan.expiration_date ?? "");
  return (
    <FormDialog
      title={`Edit ${plan.plan_name}`}
      trigger={
        <Button size="1" variant="ghost">
          <Pencil1Icon /> Edit
        </Button>
      }
      onOpen={() => {
        setStart(plan.start_date);
        setExpiration(plan.expiration_date ?? "");
      }}
      canSubmit={!datesError(start, expiration)}
      onSubmit={async () => {
        await patientApi.editPlan(plan.plan_id, { start_date: start, expiration_date: expiration });
        await onSaved();
      }}
    >
      <DateFields start={start} expiration={expiration} onStart={setStart} onExpiration={setExpiration} />
    </FormDialog>
  );
}

export function InsuranceCard({ plans, facilities, onChanged }: {
  plans: Enrollment[]; facilities: InNetworkFacility[]; onChanged: () => Promise<void>;
}) {
  const enrolledIds = new Set(plans.map((p) => p.plan_id));
  return (
    <SectionCard title="Insurance" icon={<IdCardIcon />} count={plans.length}
      actions={<AddPlanDialog enrolledIds={enrolledIds} onSaved={onChanged} />}>
      <Flex direction="column" gap="3">
        {plans.length === 0 ? (
          <EmptyState message="No insurance plans yet. Add one to see in-network facilities." />
        ) : (
          plans.map((p) => (
            <div key={p.plan_id} className="sub-panel">
              <Flex justify="between" align="center" gap="2">
                <Text weight="medium">{p.plan_name}</Text>
                <Badge color={p.is_active ? "green" : "gray"} variant="soft">
                  {p.is_active ? "Active" : "Expired"}
                </Badge>
              </Flex>
              <Text as="div" size="2" color="gray">
                {p.plan_type}
                {p.plan_holder ? ` · ${p.plan_holder}` : ""}
              </Text>
              <Flex justify="between" align="center" gap="2" mt="1">
                <Text size="1" color="gray">
                  {formatDate(p.start_date)} → {p.expiration_date ? formatDate(p.expiration_date) : "no end date"}
                </Text>
                <Flex gap="3" align="center">
                  <ConfirmButton label="Remove" title={`Remove ${p.plan_name}?`}
                    description="This removes the plan from your rolodex. You can add it again later."
                    onConfirm={async () => {
                      await patientApi.removePlan(p.plan_id);
                      await onChanged();
                    }} />
                  <EditPlanDialog plan={p} onSaved={onChanged} />
                </Flex>
              </Flex>
            </div>
          ))
        )}

        <SubPanel label={`IN-NETWORK FACILITIES (${facilities.length})`}>
          {facilities.length === 0 ? (
            <Text as="div" size="2" color="gray">
              No in-network facilities for your active plans.
            </Text>
          ) : (
            <Flex direction="column" gap="2">
              {facilities.slice(0, 5).map((f) => (
                <Box key={f.facility_id}>
                  <Text as="div" size="2" weight="medium">
                    {f.facility_name}
                  </Text>
                  <Text as="div" size="1" color="gray">
                    {f.address}
                  </Text>
                </Box>
              ))}
              {facilities.length > 5 && (
                <Text size="1" color="gray">
                  +{facilities.length - 5} more · see Emergency Site
                </Text>
              )}
            </Flex>
          )}
        </SubPanel>
      </Flex>
    </SectionCard>
  );
}
