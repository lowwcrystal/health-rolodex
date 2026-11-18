import { Checkbox, Flex, Text } from "@radix-ui/themes";
import { useState, type ReactNode } from "react";
import type { RelationInput } from "@/api/patient";
import { FormDialog } from "@/components/ui/FormDialog";
import { FormField } from "@/components/ui/FormField";
import { OptionSelect } from "@/components/ui/OptionSelect";
import { MAX_LEN, RELATION_LABELS, RELATION_TYPES, type RelationType } from "@/types/schema";

/** guardian_must_be_parent_or_guardian */
const canBeGuardian = (t: RelationType | null) => t === "parent" || t === "guardian";

/** What I am to them → what they are to me, as a starting suggestion when accepting a request. */
export const REVERSE_RELATION: Record<RelationType, RelationType> = {
  parent: "child",
  child: "parent",
  sibling: "sibling",
  spouse: "spouse",
  guardian: "other",
  other: "other",
};

interface Props {
  title: string;
  description?: string;
  trigger: ReactNode;
  submitLabel: string;
  /** Ask for the other person's email (only when adding someone new). */
  askEmail?: boolean;
  /** Whose relation this is, e.g. "Donna is my…" */
  subjectName?: string;
  initial?: Partial<RelationInput>;
  onSubmit: (email: string, fields: RelationInput) => Promise<void>;
}

/** Add / edit / accept form for one relationto row: relation type (SCHEMA §5) + emergency contact + guardian. */
export function RelativeDialog({ title, description, trigger, submitLabel, askEmail, subjectName, initial, onSubmit }: Props) {
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState<RelationType | null>(null);
  const [emergency, setEmergency] = useState(false);
  const [guardian, setGuardian] = useState(false);

  const emailOk = !askEmail || (email.trim().includes("@") && email.trim().length <= MAX_LEN.email);
  const guardianAllowed = canBeGuardian(relation);

  return (
    <FormDialog
      title={title}
      description={description}
      trigger={trigger}
      submitLabel={submitLabel}
      onOpen={() => {
        setEmail("");
        setRelation(initial?.relation_type ?? null);
        setEmergency(initial?.is_emergency_contact ?? false);
        setGuardian(initial?.is_guardian ?? false);
      }}
      canSubmit={emailOk && relation !== null}
      onSubmit={() =>
        onSubmit(email.trim(), {
          relation_type: relation as RelationType,
          is_emergency_contact: emergency,
          is_guardian: guardianAllowed && guardian,
        })
      }
    >
      {askEmail && (
        <FormField id="relative_email" label="Their email" type="email" required maxLength={MAX_LEN.email}
          value={email} onChange={setEmail} placeholder="name@example.com"
          hint="They need a Health Rolodex account. They'll get a request to accept." />
      )}
      <OptionSelect
        id="relation_type"
        label={subjectName ? `${subjectName} is my…` : "They are my…"}
        placeholder="Choose a relation"
        value={relation}
        options={RELATION_TYPES.map((t) => ({ value: t, label: RELATION_LABELS[t] }))}
        onChange={(v) => {
          const next = v as RelationType | null;
          setRelation(next);
          if (!canBeGuardian(next)) setGuardian(false);
        }}
      />
      <Text as="label" size="2">
        <Flex gap="2" align="center">
          <Checkbox checked={emergency} onCheckedChange={(c) => setEmergency(c === true)} />
          Emergency contact
        </Flex>
      </Text>
      <Flex direction="column" gap="1">
        <Text as="label" size="2" color={guardianAllowed ? undefined : "gray"}>
          <Flex gap="2" align="center">
            <Checkbox checked={guardian} disabled={!guardianAllowed} onCheckedChange={(c) => setGuardian(c === true)} />
            Legal guardian
          </Flex>
        </Text>
        {!guardianAllowed && (
          <Text size="1" color="gray">
            Only a parent or guardian can be your legal guardian.
          </Text>
        )}
      </Flex>
    </FormDialog>
  );
}
