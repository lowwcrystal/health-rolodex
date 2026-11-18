import { PlusIcon } from "@radix-ui/react-icons";
import { Box, Button, Checkbox, Dialog, Flex, ScrollArea, Switch, Text, TextArea } from "@radix-ui/themes";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/api/client";
import { documentsApi, type CreateDocumentInput } from "@/api/documents";
import { ErrorCallout } from "@/components/ui/ErrorCallout";
import { FormField } from "@/components/ui/FormField";
import { OptionSelect } from "@/components/ui/OptionSelect";
import { safeHref } from "@/components/ui/format";
import { DOCUMENT_KINDS, DOCUMENT_KIND_KEYS, MAX_LEN_FILE_LINK, maxNotesLength, type DocumentKind, type Provider } from "@/types/schema";

interface Props {
  /** Ordered list: your PCP and providers you've visited first. */
  providers: (Provider & { suggested?: boolean })[];
  onCreated: () => void;
}

type UrlField = "front_url" | "back_url" | "file_url";

function checkUrl(value: string, required: boolean): string | undefined {
  const v = value.trim();
  if (!v) return required ? "A link is required." : undefined;
  if (v.length > MAX_LEN_FILE_LINK) return `Links must be at most ${MAX_LEN_FILE_LINK} characters.`;
  if (!safeHref(v)) return "Enter a full link starting with https://";
  return undefined;
}

export function AddDocumentDialog({ providers, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<DocumentKind | null>(null);
  const [urls, setUrls] = useState<Record<UrlField, string>>({ front_url: "", back_url: "", file_url: "" });
  const [notes, setNotes] = useState("");
  const [shareable, setShareable] = useState(false);
  const [providerIds, setProviderIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<Partial<Record<UrlField | "kind", string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const twoSided = kind ? DOCUMENT_KINDS[kind].twoSided : false;
  const notesMax = kind ? maxNotesLength(kind) : 500;

  const reset = () => {
    setKind(null);
    setUrls({ front_url: "", back_url: "", file_url: "" });
    setNotes("");
    setShareable(false);
    setProviderIds([]);
    setErrors({});
    setFormError(null);
  };

  const toggleProvider = (id: number, checked: boolean) =>
    setProviderIds((ids) => (checked ? [...ids, id] : ids.filter((x) => x !== id)));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!kind) found.kind = "Choose a document type.";
    if (twoSided) {
      found.front_url = checkUrl(urls.front_url, true);
      found.back_url = checkUrl(urls.back_url, true);
    } else {
      found.file_url = checkUrl(urls.file_url, false);
    }
    const clean = Object.fromEntries(Object.entries(found).filter(([, v]) => v)) as typeof errors;
    setErrors(clean);
    setFormError(null);
    if (Object.keys(clean).length || !kind) return;

    const input: CreateDocumentInput = {
      kind,
      notes: notes.trim(),
      is_shareable: shareable,
      provider_ids: shareable ? providerIds : [],
      ...(twoSided
        ? { front_url: urls.front_url.trim(), back_url: urls.back_url.trim() }
        : { file_url: urls.file_url.trim() }),
    };
    setSubmitting(true);
    try {
      await documentsApi.create(input);
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't save the document.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Dialog.Trigger>
        <Button size="3">
          <PlusIcon /> Add document
        </Button>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="560px">
        <Dialog.Title>Add a document</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          Choose what it is, then paste a link to the file (for example, a storage bucket URL).
        </Dialog.Description>

        <form onSubmit={onSubmit} noValidate>
          <Flex direction="column" gap="4">
            <ErrorCallout message={formError} />

            <Box>
              <OptionSelect
                id="kind"
                label="Document type"
                placeholder="Select a type"
                value={kind}
                options={DOCUMENT_KIND_KEYS.map((k) => ({
                  value: k,
                  label: DOCUMENT_KINDS[k].twoSided ? `${DOCUMENT_KINDS[k].label} (front & back)` : DOCUMENT_KINDS[k].label,
                }))}
                onChange={(v) => {
                  setKind(v as DocumentKind | null);
                  setErrors({});
                }}
              />
              {errors.kind && (
                <Text size="1" color="red">
                  {errors.kind}
                </Text>
              )}
            </Box>

            {kind &&
              (twoSided ? (
                <>
                  <FormField id="front_url" label="Front of card" type="url" placeholder="https://…/front.jpg"
                    maxLength={MAX_LEN_FILE_LINK} value={urls.front_url} error={errors.front_url}
                    onChange={(v) => setUrls((u) => ({ ...u, front_url: v }))} />
                  <FormField id="back_url" label="Back of card" type="url" placeholder="https://…/back.jpg"
                    maxLength={MAX_LEN_FILE_LINK} value={urls.back_url} error={errors.back_url}
                    onChange={(v) => setUrls((u) => ({ ...u, back_url: v }))} />
                </>
              ) : (
                <FormField id="file_url" label="File link" optional type="url" placeholder="https://…/document.pdf"
                  maxLength={MAX_LEN_FILE_LINK} value={urls.file_url} error={errors.file_url}
                  onChange={(v) => setUrls((u) => ({ ...u, file_url: v }))} />
              ))}

            {kind && (
              <Flex direction="column" gap="1">
                <Text as="label" htmlFor="notes" size="2" weight="medium">
                  Notes{" "}
                  <Text color="gray" weight="regular">
                    (optional)
                  </Text>
                </Text>
                <TextArea id="notes" value={notes} maxLength={notesMax} onChange={(e) => setNotes(e.target.value)}
                  placeholder={twoSided ? "e.g. Member ID ends in 4821" : "e.g. Annual bloodwork"} />
                <Text size="1" color="gray" align="right">
                  {notes.length}/{notesMax}
                </Text>
              </Flex>
            )}

            {kind && (
              <Flex direction="column" gap="3">
                <Text as="label" size="2">
                  <Flex gap="2" align="center">
                    <Switch checked={shareable} onCheckedChange={setShareable} />
                    Allow sharing with providers
                  </Flex>
                </Text>
                {shareable && (
                  <Box>
                    <Text size="2" weight="medium">
                      Share with
                    </Text>
                    <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: 200 }}>
                      <Flex direction="column" gap="2" py="2" pr="3">
                        {providers.map((p) => (
                          <Text as="label" size="2" key={p.provider_id}>
                            <Flex gap="2" align="center">
                              <Checkbox
                                checked={providerIds.includes(p.provider_id)}
                                onCheckedChange={(c) => toggleProvider(p.provider_id, c === true)}
                              />
                              {p.provider_name}
                              {p.suggested && (
                                <Text size="1" color="indigo">
                                  · your care team
                                </Text>
                              )}
                            </Flex>
                          </Text>
                        ))}
                      </Flex>
                    </ScrollArea>
                  </Box>
                )}
              </Flex>
            )}

            <Flex gap="3" justify="end" mt="2">
              <Dialog.Close>
                <Button type="button" variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" loading={submitting} disabled={!kind}>
                Save document
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
