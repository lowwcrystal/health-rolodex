import { ExternalLinkIcon, FileTextIcon, IdCardIcon, LockClosedIcon, Share1Icon } from "@radix-ui/react-icons";
import { Badge, Button, Card, Flex, Text } from "@radix-ui/themes";
import { formatDate, safeHref } from "@/components/ui/format";
import { DOCUMENT_KINDS, type HealthRecord } from "@/types/schema";
import type { DocumentGroup } from "./groupDocuments";

function OpenLink({ record, label }: { record: HealthRecord | null; label: string }) {
  const href = safeHref(record?.file_link);
  if (!href) {
    return (
      <Button size="1" variant="soft" color="gray" disabled>
        {label}: no link
      </Button>
    );
  }
  return (
    <Button asChild size="1" variant="soft">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label} <ExternalLinkIcon />
      </a>
    </Button>
  );
}

export function DocumentCard({ doc }: { doc: DocumentGroup }) {
  const kind = DOCUMENT_KINDS[doc.kind];
  return (
    <Card size="2">
      <Flex direction="column" gap="3" height="100%">
        <Flex align="center" gap="3">
          <span className="icon-tile">{kind.twoSided ? <IdCardIcon /> : <FileTextIcon />}</span>
          <Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
            <Text weight="bold">{kind.label}</Text>
            <Text size="1" color="gray">
              Added {formatDate(doc.uploadDate)}
            </Text>
          </Flex>
          {kind.twoSided && <Badge variant="soft">Front & back</Badge>}
        </Flex>

        {doc.notes && (
          <Text size="2" color="gray">
            {doc.notes}
          </Text>
        )}

        <Flex gap="2" wrap="wrap">
          {kind.twoSided || doc.front || doc.back ? (
            <>
              <OpenLink record={doc.front} label="Front" />
              <OpenLink record={doc.back} label="Back" />
            </>
          ) : (
            <OpenLink record={doc.file} label="Open file" />
          )}
        </Flex>

        <Flex align="center" gap="1" mt="auto">
          {!doc.isShareable ? (
            <>
              <LockClosedIcon />
              <Text size="1" color="gray">
                Private
              </Text>
            </>
          ) : doc.sharedWith.length ? (
            <>
              <Share1Icon color="var(--accent-11)" />
              <Text size="1" color="indigo">
                Shared with {doc.sharedWith.join(", ")}
              </Text>
            </>
          ) : (
            <Text size="1" color="gray">
              Shareable · not shared yet
            </Text>
          )}
        </Flex>
      </Flex>
    </Card>
  );
}
