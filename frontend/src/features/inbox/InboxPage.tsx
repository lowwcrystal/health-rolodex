import { EnvelopeClosedIcon, FileTextIcon, PaperPlaneIcon } from "@radix-ui/react-icons";
import { Badge, Flex, Grid, Spinner, Text } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/api/client";
import { patientApi } from "@/api/patient";
import { PageContainer } from "@/components/layout/PageContainer";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCallout } from "@/components/ui/ErrorCallout";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDate } from "@/components/ui/format";
import { RequestActions } from "@/features/family/RequestActions";
import { DOCUMENT_KINDS, parseDocumentKind, RELATION_LABELS, type Inbox } from "@/types/schema";
import { notifyInboxChanged } from "./inboxEvents";

/** One line per document per doctor; a two-sided card's front and back rows count once. */
function groupShares(shares: Inbox["shares"]) {
  const seen = new Map<string, { label: string; provider: string; date: string }>();
  for (const s of shares) {
    const { kind } = parseDocumentKind(s.record_type, s.notes);
    const label = DOCUMENT_KINDS[kind].label;
    const key = `${label}|${s.provider_id}|${s.upload_date}`;
    if (!seen.has(key)) seen.set(key, { label, provider: s.provider_name, date: s.upload_date });
  }
  return [...seen.entries()].map(([key, v]) => ({ key, ...v }));
}

/** Family requests for me, requests I sent, and my documents shared with doctors. */
export function InboxPage() {
  const [data, setData] = useState<Inbox | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await patientApi.inbox());
      notifyInboxChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your inbox.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shares = useMemo(() => (data ? groupShares(data.shares) : []), [data]);

  return (
    <PageContainer backTo="/dashboard" title="Inbox" subtitle="Family requests and the documents you've shared.">
      {error ? (
        <ErrorCallout message={error} />
      ) : !data ? (
        <Flex justify="center" py="9">
          <Spinner size="3" />
        </Flex>
      ) : (
        <div className="dashboard-grid">
          <SectionCard title="Requests for you" icon={<EnvelopeClosedIcon />} count={data.requests.length}>
            {data.requests.length === 0 ? (
              <EmptyState message="No requests right now." />
            ) : (
              <Flex direction="column" gap="3">
                {data.requests.map((r) => (
                  <div key={r.user_id} className="sub-panel">
                    <Text as="div" weight="medium">
                      {r.first_name} {r.last_name}
                    </Text>
                    <Text as="div" size="2" color="gray">
                      Added you as their {RELATION_LABELS[r.relation_type].toLowerCase()}
                    </Text>
                    <Flex justify="end" mt="2">
                      <RequestActions request={r} onDone={load} />
                    </Flex>
                  </div>
                ))}
              </Flex>
            )}
          </SectionCard>

          <SectionCard title="Requests you sent" icon={<PaperPlaneIcon />} count={data.sent.length}>
            {data.sent.length === 0 ? (
              <EmptyState message="No pending requests." />
            ) : (
              <Flex direction="column" gap="3">
                {data.sent.map((r) => (
                  <div key={r.user_id} className="sub-panel">
                    <Flex justify="between" align="center" gap="2">
                      <Text weight="medium">
                        {r.first_name} {r.last_name}
                      </Text>
                      <Badge color="gray" variant="soft">
                        Waiting
                      </Badge>
                    </Flex>
                    <Text as="div" size="2" color="gray">
                      Your {RELATION_LABELS[r.relation_type].toLowerCase()}
                      {r.is_emergency_contact ? " · emergency contact" : ""}
                    </Text>
                    <Flex justify="end" mt="2">
                      <ConfirmButton
                        label="Cancel request"
                        title={`Cancel your request to ${r.first_name}?`}
                        description={`${r.first_name} won't see your request anymore.`}
                        confirmLabel="Cancel request"
                        onConfirm={async () => {
                          await patientApi.removeRelative(r.user_id);
                          await load();
                        }}
                      />
                    </Flex>
                  </div>
                ))}
              </Flex>
            )}
          </SectionCard>

          <SectionCard title="Shared documents" icon={<FileTextIcon />} count={shares.length} wide>
            {shares.length === 0 ? (
              <EmptyState message="You haven't shared any documents with a doctor yet." />
            ) : (
              <Grid columns={{ initial: "1", sm: "2", md: "3" }} gap="3">
                {shares.map((s) => (
                  <div key={s.key} className="sub-panel">
                    <Text as="div" weight="medium">
                      {s.label}
                    </Text>
                    <Text as="div" size="2" color="gray">
                      Shared with {s.provider} · {formatDate(s.date)}
                    </Text>
                  </div>
                ))}
              </Grid>
            )}
          </SectionCard>
        </div>
      )}
    </PageContainer>
  );
}
