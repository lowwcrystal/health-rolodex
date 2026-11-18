import { ActivityLogIcon, Pencil1Icon, PlusIcon } from "@radix-ui/react-icons";
import { Badge, Button, Flex, Text } from "@radix-ui/themes";
import { useState, type ComponentProps } from "react";
import { patientApi } from "@/api/patient";
import { useOptions } from "@/api/useOptions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormDialog } from "@/components/ui/FormDialog";
import { FormField } from "@/components/ui/FormField";
import { OptionSelect } from "@/components/ui/OptionSelect";
import { SectionCard } from "@/components/ui/SectionCard";
import { capitalize, formatDate, todayISO } from "@/components/ui/format";
import type { Category, Diagnosis } from "@/types/schema";

const CATEGORY_COLOR: Record<Category, ComponentProps<typeof Badge>["color"]> = {
  allergy: "amber",
  chronic: "indigo",
  genetic: "violet",
};

const dateError = (d: string) => (!d ? "Date is required." : d > todayISO() ? "Date can't be in the future." : undefined);

/** Only conditions the user doesn't already have (diagnosed PK, SCHEMA §6.3). */
function AddConditionDialog({ haveIds, onSaved }: { haveIds: Set<number>; onSaved: () => Promise<void> }) {
  const options = useOptions();
  const [conditionId, setConditionId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const available = (options?.conditions ?? []).filter((c) => !haveIds.has(c.condition_id));
  return (
    <FormDialog
      title="Add condition"
      trigger={
        <Button size="1" variant="soft">
          <PlusIcon /> Add condition
        </Button>
      }
      submitLabel="Add condition"
      onOpen={() => {
        setConditionId(null);
        setDate(todayISO());
      }}
      canSubmit={conditionId !== null && !dateError(date)}
      onSubmit={async () => {
        await patientApi.addCondition(Number(conditionId), date);
        await onSaved();
      }}
    >
      <OptionSelect id="condition" label="Condition" placeholder={options ? "Select a condition…" : "Loading…"} value={conditionId}
        options={available.map((c) => ({ value: String(c.condition_id), label: `${c.condition_name} · ${capitalize(c.category)}` }))}
        onChange={setConditionId} />
      <FormField id="diagnosed_date" label="Diagnosed on" type="date" required max={todayISO()} value={date} onChange={setDate}
        error={date ? dateError(date) : undefined} />
    </FormDialog>
  );
}

function EditConditionDialog({ condition, onSaved }: { condition: Diagnosis; onSaved: () => Promise<void> }) {
  const [date, setDate] = useState(condition.diagnosed_date);
  return (
    <FormDialog
      title={`Edit ${condition.condition_name}`}
      trigger={
        <Button size="1" variant="ghost">
          <Pencil1Icon /> Edit
        </Button>
      }
      onOpen={() => setDate(condition.diagnosed_date)}
      canSubmit={!dateError(date) && date !== condition.diagnosed_date}
      onSubmit={async () => {
        await patientApi.editCondition(condition.condition_id, date);
        await onSaved();
      }}
    >
      <FormField id="diagnosed_date" label="Diagnosed on" type="date" required max={todayISO()} value={date} onChange={setDate}
        error={date ? dateError(date) : undefined} />
    </FormDialog>
  );
}

export function ConditionsCard({ conditions, onChanged }: { conditions: Diagnosis[]; onChanged: () => Promise<void> }) {
  const haveIds = new Set(conditions.map((c) => c.condition_id));
  return (
    <SectionCard title="Conditions" icon={<ActivityLogIcon />} count={conditions.length}
      actions={<AddConditionDialog haveIds={haveIds} onSaved={onChanged} />}>
      {conditions.length === 0 ? (
        <EmptyState message="No conditions yet. Add one to get doctor recommendations." />
      ) : (
        <Flex direction="column" gap="3">
          {conditions.map((c) => (
            <div key={c.condition_id} className="sub-panel">
              <Flex justify="between" align="center" gap="2">
                <Text weight="medium">{c.condition_name}</Text>
                <Badge color={CATEGORY_COLOR[c.category]} variant="soft">
                  {capitalize(c.category)}
                </Badge>
              </Flex>
              {c.recommended_specialities && (
                <Text as="div" size="2" color="gray">
                  Recommended: {c.recommended_specialities}
                </Text>
              )}
              <Flex justify="between" align="center" gap="2" mt="1">
                <Text size="1" color="gray">
                  Diagnosed {formatDate(c.diagnosed_date)}
                </Text>
                <Flex gap="3" align="center">
                  <ConfirmButton label="Remove" title={`Remove ${c.condition_name}?`}
                    description="This removes the condition from your rolodex and updates your recommendations."
                    onConfirm={async () => {
                      await patientApi.removeCondition(c.condition_id);
                      await onChanged();
                    }} />
                  <EditConditionDialog condition={c} onSaved={onChanged} />
                </Flex>
              </Flex>
            </div>
          ))}
        </Flex>
      )}
    </SectionCard>
  );
}
