import { Pencil1Icon, PersonIcon, PlusIcon } from "@radix-ui/react-icons";
import { Avatar, Badge, Button, Flex, Text } from "@radix-ui/themes";
import { patientApi } from "@/api/patient";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/SectionCard";
import { RelativeDialog } from "@/features/family/RelativeDialog";
import { RequestActions } from "@/features/family/RequestActions";
import { RELATION_LABELS, type FamilyRequest, type Relative } from "@/types/schema";
import { SubPanel } from "./CareTeamCard";

interface Props {
  family: Relative[];
  requests: FamilyRequest[];
  onChanged: () => Promise<void>;
}

/** relationto: my relatives (pending until they accept) and requests waiting for me. */
export function FamilyCard({ family, requests, onChanged }: Props) {
  return (
    <SectionCard
      title="Family & contacts"
      icon={<PersonIcon />}
      count={family.length}
      actions={
        <RelativeDialog
          title="Add a relative"
          description="They'll get a request in their Inbox. They count as your contact once they accept."
          trigger={
            <Button size="1" variant="soft">
              <PlusIcon /> Add relative
            </Button>
          }
          submitLabel="Send request"
          askEmail
          onSubmit={async (email, fields) => {
            await patientApi.addRelative(email, fields);
            await onChanged();
          }}
        />
      }
    >
      <Flex direction="column" gap="3">
        {requests.length > 0 && (
          <SubPanel label={`REQUESTS FOR YOU (${requests.length})`}>
            <Flex direction="column" gap="2">
              {requests.map((r) => (
                <Flex key={r.user_id} justify="between" align="center" gap="3" wrap="wrap">
                  <Text size="2">
                    <Text weight="medium">
                      {r.first_name} {r.last_name}
                    </Text>{" "}
                    added you as their {RELATION_LABELS[r.relation_type].toLowerCase()}
                  </Text>
                  <RequestActions request={r} onDone={onChanged} />
                </Flex>
              ))}
            </Flex>
          </SubPanel>
        )}

        {family.length === 0 ? (
          <EmptyState message="No relatives yet. Add one by their email." />
        ) : (
          family.map((r) => (
            <div key={r.relative_id} className="sub-panel">
              <Flex align="center" gap="3">
                <Avatar size="2" radius="full" fallback={r.first_name.charAt(0)} />
                <Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="medium">
                    {r.first_name} {r.last_name}
                  </Text>
                  <Text size="2" color="gray">
                    {RELATION_LABELS[r.relation_type]}
                    {r.email ? ` · ${r.email}` : ""}
                  </Text>
                </Flex>
                <Flex gap="1" wrap="wrap" justify="end">
                  {!r.confirmed && (
                    <Badge color="gray" variant="soft">
                      Pending
                    </Badge>
                  )}
                  {r.is_emergency_contact && (
                    <Badge color="red" variant="soft">
                      Emergency
                    </Badge>
                  )}
                  {r.is_guardian && <Badge variant="soft">Guardian</Badge>}
                </Flex>
              </Flex>
              <Flex justify="end" gap="3" mt="2">
                <ConfirmButton
                  label={r.confirmed ? "Remove" : "Cancel request"}
                  title={r.confirmed ? `Remove ${r.first_name}?` : `Cancel your request to ${r.first_name}?`}
                  description={
                    r.confirmed
                      ? `This removes the link for both of you. ${r.first_name} will no longer be your contact.`
                      : `${r.first_name} won't see your request anymore.`
                  }
                  confirmLabel={r.confirmed ? "Remove" : "Cancel request"}
                  onConfirm={async () => {
                    await patientApi.removeRelative(r.relative_id);
                    await onChanged();
                  }}
                />
                <RelativeDialog
                  title={`Edit ${r.first_name} ${r.last_name}`}
                  trigger={
                    <Button size="1" variant="ghost">
                      <Pencil1Icon /> Edit
                    </Button>
                  }
                  submitLabel="Save"
                  subjectName={r.first_name}
                  initial={r}
                  onSubmit={async (_email, fields) => {
                    await patientApi.editRelative(r.relative_id, fields);
                    await onChanged();
                  }}
                />
              </Flex>
            </div>
          ))
        )}
      </Flex>
    </SectionCard>
  );
}
