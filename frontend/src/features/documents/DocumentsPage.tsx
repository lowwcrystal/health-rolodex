import { Flex, Grid, Spinner, Tabs, Text } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi } from "@/api/auth";
import { ApiError } from "@/api/client";
import { patientApi } from "@/api/patient";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCallout } from "@/components/ui/ErrorCallout";
import { OptionSelect } from "@/components/ui/OptionSelect";
import { DOCUMENT_KINDS, DOCUMENT_KIND_KEYS, type DocumentKind, type PatientDashboard, type Provider } from "@/types/schema";
import { AddDocumentDialog } from "./AddDocumentDialog";
import { DocumentCard } from "./DocumentCard";
import { groupDocuments } from "./groupDocuments";

export function DocumentsPage() {
  const [data, setData] = useState<PatientDashboard | null>(null);
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [filter, setFilter] = useState<DocumentKind | null>(null);
  const [tab, setTab] = useState<"all" | "shared">("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    patientApi
      .dashboard()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load your documents."));
  }, []);

  useEffect(() => {
    load();
    authApi
      .options()
      .then((o) => setAllProviders(o.providers))
      .catch(() => undefined);
  }, [load]);

  const documents = useMemo(() => (data ? groupDocuments(data.records) : []), [data]);
  // "Shared" = shared with at least one doctor (sharedwith; documents can only be shared with providers).
  const sharedCount = documents.filter((d) => d.sharedWith.length > 0).length;
  const visible = documents
    .filter((d) => tab === "all" || d.sharedWith.length > 0)
    .filter((d) => !filter || d.kind === filter);

  // Your PCP and providers you've visited go first in the share list.
  const providers = useMemo(() => {
    const careTeam = new Set<number>();
    if (data?.profile.pcp_provider_id) careTeam.add(data.profile.pcp_provider_id);
    data?.visits.forEach((v) => careTeam.add(v.provider_id));
    return [...allProviders]
      .map((p) => ({ ...p, suggested: careTeam.has(p.provider_id) }))
      .sort((a, b) => Number(b.suggested) - Number(a.suggested) || a.provider_name.localeCompare(b.provider_name));
  }, [allProviders, data]);

  if (error) {
    return (
      <PageContainer title="My documents">
        <ErrorCallout message={error} />
      </PageContainer>
    );
  }
  if (!data) {
    return (
      <Flex justify="center" py="9">
        <Spinner size="3" />
      </Flex>
    );
  }

  return (
    <PageContainer
      backTo="/dashboard"
      title="My documents"
      subtitle="Insurance cards, ID, lab results and more, kept in one place."
      actions={<AddDocumentDialog providers={providers} onCreated={load} />}
    >
      <Flex direction="column" gap="4">
        <Tabs.Root value={tab} onValueChange={(v) => setTab(v as "all" | "shared")}>
          <Tabs.List>
            <Tabs.Trigger value="all">All ({documents.length})</Tabs.Trigger>
            <Tabs.Trigger value="shared">Shared ({sharedCount})</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        {tab === "shared" && (
          <Text size="2" color="gray">
            Documents you've shared with a doctor. Each card shows who can see it.
          </Text>
        )}
        <div style={{ maxWidth: 260 }}>
          <OptionSelect
            id="doc_filter"
            label="Show"
            placeholder="All documents"
            value={filter}
            options={DOCUMENT_KIND_KEYS.map((k) => ({ value: k, label: DOCUMENT_KINDS[k].label }))}
            onChange={(v) => setFilter(v as DocumentKind | null)}
          />
        </div>
        {visible.length === 0 ? (
          <EmptyState
            message={
              tab === "shared"
                ? "Nothing shared yet. Mark a document shareable and choose a doctor when you add it."
                : filter
                  ? "No documents of this type yet."
                  : "No documents yet. Add your insurance card to get started."
            }
          />
        ) : (
          <Grid columns={{ initial: "1", sm: "2", md: "3" }} gap="4">
            {visible.map((doc) => (
              <DocumentCard key={doc.key} doc={doc} />
            ))}
          </Grid>
        )}
      </Flex>
    </PageContainer>
  );
}
