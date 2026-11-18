import { AlertDialog, Button, Flex } from "@radix-ui/themes";
import { useState } from "react";
import { ApiError } from "@/api/client";

interface Props {
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
}

/** A small red "Remove" button that asks before doing it. */
export function ConfirmButton({ label, title, description, confirmLabel = "Remove", onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <AlertDialog.Root onOpenChange={() => setError(null)}>
      <AlertDialog.Trigger>
        <Button size="1" variant="ghost" color="red">
          {label}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="420px">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description size="2">{error ?? description}</AlertDialog.Description>
        <Flex gap="3" justify="end" mt="4">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </AlertDialog.Cancel>
          <Button
            color="red"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Couldn't remove it. Try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
