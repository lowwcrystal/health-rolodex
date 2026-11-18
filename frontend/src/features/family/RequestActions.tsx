import { Button, Flex } from "@radix-ui/themes";
import { patientApi } from "@/api/patient";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import type { FamilyRequest } from "@/types/schema";
import { RelativeDialog, REVERSE_RELATION } from "./RelativeDialog";

/** Accept (choose what they are to you) or Decline one incoming family request. */
export function RequestActions({ request: r, onDone }: { request: FamilyRequest; onDone: () => Promise<void> }) {
  return (
    <Flex gap="3" align="center">
      <ConfirmButton
        label="Decline"
        title={`Decline ${r.first_name}'s request?`}
        description={`${r.first_name} ${r.last_name} won't be linked to you. They can send a new request later.`}
        confirmLabel="Decline"
        onConfirm={async () => {
          await patientApi.declineRequest(r.user_id);
          await onDone();
        }}
      />
      <RelativeDialog
        title={`Accept ${r.first_name} ${r.last_name}`}
        description="Choose what they are to you. Only you can see and change these settings."
        trigger={<Button size="1">Accept</Button>}
        submitLabel="Accept"
        subjectName={r.first_name}
        initial={{ relation_type: REVERSE_RELATION[r.relation_type] }}
        onSubmit={async (_email, fields) => {
          await patientApi.acceptRequest(r.user_id, fields);
          await onDone();
        }}
      />
    </Flex>
  );
}
