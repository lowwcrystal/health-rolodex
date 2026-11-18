import { Button, Dialog, Flex } from "@radix-ui/themes";
import { useState, type FormEvent, type ReactNode } from "react";
import { ApiError } from "@/api/client";
import { ErrorCallout } from "./ErrorCallout";

interface Props {
  title: string;
  description?: string;
  /** The button that opens the dialog. */
  trigger: ReactNode;
  submitLabel?: string;
  canSubmit?: boolean;
  /** Throw (e.g. ApiError) to show the message inside the dialog; resolve to close it. */
  onSubmit: () => Promise<void>;
  /** Called when the dialog opens, to reset the form. */
  onOpen?: () => void;
  children: ReactNode;
}

/** A small Radix dialog with a form, Cancel/Save, and the server's error message shown inline. */
export function FormDialog({ title, description, trigger, submitLabel = "Save", canSubmit = true, onSubmit, onOpen, children }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setError(null);
      onOpen?.();
    }
    setOpen(next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit();
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>{title}</Dialog.Title>
        {description && (
          <Dialog.Description size="2" color="gray" mb="3">
            {description}
          </Dialog.Description>
        )}
        <form onSubmit={submit} noValidate>
          <Flex direction="column" gap="3">
            {children}
            <ErrorCallout message={error} />
            <Flex gap="3" justify="end" mt="2">
              <Dialog.Close>
                <Button type="button" variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" loading={submitting} disabled={!canSubmit}>
                {submitLabel}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
