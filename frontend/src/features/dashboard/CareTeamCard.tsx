import { HeartIcon, Pencil1Icon, PlusIcon } from "@radix-ui/react-icons";
import { Button, Flex, Text } from "@radix-ui/themes";
import { useState, type ReactNode } from "react";
import { patientApi } from "@/api/patient";
import { useOptions } from "@/api/useOptions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { FormDialog } from "@/components/ui/FormDialog";
import { OptionSelect } from "@/components/ui/OptionSelect";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { providerOptionLabel } from "@/components/ui/format";
import type { Profile, Visit } from "@/types/schema";

/** A bordered block inside a card, with its own label and actions. */
export function SubPanel({ label, actions, children }: { label: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="sub-panel">
      <Flex justify="between" align="center" gap="2" mb="1">
        <Text size="1" color="indigo" weight="bold">
          {label}
        </Text>
        {actions && (
          <Flex gap="3" align="center">
            {actions}
          </Flex>
        )}
      </Flex>
      {children}
    </div>
  );
}

type Field = "pcp_provider_id" | "pharmacy_id";

/** Add / Change dialog for one care-team field: a dropdown of every provider or pharmacy. */
function PickDialog({ field, current, onSaved }: { field: Field; current: number | null; onSaved: () => Promise<void> }) {
  const options = useOptions();
  const [value, setValue] = useState<string | null>(null);
  const isPcp = field === "pcp_provider_id";
  const items = !options
    ? []
    : isPcp
      ? options.providers.map((p) => ({ value: String(p.provider_id), label: providerOptionLabel(p) }))
      : options.pharmacies.map((p) => ({ value: String(p.pharmacy_id), label: `${p.pharmacy_name} · ${p.address}` }));

  return (
    <FormDialog
      title={isPcp ? "Primary care provider" : "Pharmacy"}
      description={isPcp ? "Choose your primary care doctor." : "Choose the pharmacy you use."}
      trigger={
        <Button size="1" variant="soft">
          {current == null ? <PlusIcon /> : <Pencil1Icon />}
          {current == null ? "Add" : "Change"}
        </Button>
      }
      onOpen={() => setValue(current == null ? null : String(current))}
      canSubmit={value !== null && value !== String(current)}
      onSubmit={async () => {
        await patientApi.updateCareTeam({ [field]: Number(value) });
        await onSaved();
      }}
    >
      <OptionSelect
        id={field}
        label={isPcp ? "Provider" : "Pharmacy"}
        placeholder={options ? "Select…" : "Loading…"}
        value={value}
        options={items}
        onChange={setValue}
      />
    </FormDialog>
  );
}

/** PCP (users.pcp_provider_id), pharmacy (users.pharmacy_id), and the other providers seen in visits. */
export function CareTeamCard({ profile, visits, onChanged }: { profile: Profile; visits: Visit[]; onChanged: () => Promise<void> }) {
  const others = new Map<number, string>();
  for (const v of visits) {
    if (v.provider_id !== profile.pcp_provider_id) others.set(v.provider_id, v.provider_name);
  }
  const clear = (field: Field) => async () => {
    await patientApi.updateCareTeam({ [field]: null });
    await onChanged();
  };

  return (
    <SectionCard title="Your health provider & pharmacy" icon={<HeartIcon />}>
      <Flex direction="column" gap="3">
        <SubPanel
          label="PRIMARY CARE"
          actions={
            <>
              {profile.pcp_provider_id != null && (
                <ConfirmButton
                  label="Remove"
                  title="Remove primary care provider?"
                  description={`${profile.pcp_name} will no longer be listed as your primary care provider.`}
                  onConfirm={clear("pcp_provider_id")}
                />
              )}
              <PickDialog field="pcp_provider_id" current={profile.pcp_provider_id} onSaved={onChanged} />
            </>
          }
        >
          {profile.pcp_name ? (
            <>
              <Text as="div" weight="medium">
                {profile.pcp_name}
              </Text>
              <Flex align="center" gap="2" wrap="wrap">
                {profile.pcp_specialities && (
                  <Text size="2" color="gray">
                    {profile.pcp_specialities}
                  </Text>
                )}
                <RatingBadge rating={profile.pcp_rating} />
              </Flex>
            </>
          ) : (
            <Text as="div" color="gray" size="2">
              No primary care provider yet.
            </Text>
          )}
        </SubPanel>

        <SubPanel
          label="PHARMACY"
          actions={
            <>
              {profile.pharmacy_id != null && (
                <ConfirmButton
                  label="Remove"
                  title="Remove pharmacy?"
                  description={`${profile.pharmacy_name} will no longer be listed as your pharmacy.`}
                  onConfirm={clear("pharmacy_id")}
                />
              )}
              <PickDialog field="pharmacy_id" current={profile.pharmacy_id} onSaved={onChanged} />
            </>
          }
        >
          {profile.pharmacy_name ? (
            <>
              <Text as="div" weight="medium">
                {profile.pharmacy_name}
              </Text>
              <Text as="div" size="2" color="gray">
                {profile.pharmacy_address}
              </Text>
            </>
          ) : (
            <Text as="div" color="gray" size="2">
              No pharmacy yet.
            </Text>
          )}
        </SubPanel>

        <SubPanel label="OTHER PROVIDERS YOU'VE SEEN">
          <Text as="div" size="2" color={others.size ? undefined : "gray"}>
            {others.size ? [...others.values()].join(", ") : "No other providers yet."}
          </Text>
        </SubPanel>
      </Flex>
    </SectionCard>
  );
}
