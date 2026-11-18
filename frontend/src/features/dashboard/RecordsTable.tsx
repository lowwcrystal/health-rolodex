import { FileTextIcon, LockClosedIcon, Share1Icon } from "@radix-ui/react-icons";
import { Badge, Flex, Link, Table, Text } from "@radix-ui/themes";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/SectionCard";
import { capitalize, formatDate, safeHref } from "@/components/ui/format";
import { DOCUMENT_KINDS, RECORD_TYPE_LABELS, parseDocumentKind, type HealthRecord } from "@/types/schema";

export function RecordsTable({ records }: { records: HealthRecord[] }) {
  return (
    <SectionCard title="Records" icon={<FileTextIcon />} count={records.length} wide>
      {records.length === 0 ? (
        <EmptyState message="No records uploaded yet." />
      ) : (
        <div className="table-scroll">
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Uploaded</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Notes</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Sharing</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {records.map((r) => {
                const href = safeHref(r.file_link);
                const doc = parseDocumentKind(r.record_type, r.notes);
                return (
                  <Table.Row key={r.record_no}>
                    <Table.RowHeaderCell>{formatDate(r.upload_date)}</Table.RowHeaderCell>
                    <Table.Cell>
                      <Badge variant="soft">
                        {DOCUMENT_KINDS[doc.kind]?.label ?? RECORD_TYPE_LABELS[r.record_type]}
                        {doc.side ? ` · ${capitalize(doc.side)}` : ""}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell style={{ maxWidth: 360 }}>
                      <Text as="div" size="2">
                        {doc.notes ?? "—"}
                      </Text>
                      {href && (
                        <Link href={href} target="_blank" rel="noopener noreferrer" size="1">
                          Open file
                        </Link>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {!r.is_shareable ? (
                        <Flex align="center" gap="1">
                          <LockClosedIcon />
                          <Text size="2" color="gray">
                            Private
                          </Text>
                        </Flex>
                      ) : r.shared_with.length === 0 ? (
                        <Text size="2" color="gray">
                          Shareable · not shared yet
                        </Text>
                      ) : (
                        <Flex direction="column" gap="1">
                          <Flex align="center" gap="1">
                            <Share1Icon color="var(--accent-11)" />
                            <Text size="2" color="indigo">
                              Shared with {r.shared_with.length}
                            </Text>
                          </Flex>
                          <Text size="1" color="gray">
                            {r.shared_with.map((p) => p.provider_name).join(", ")}
                          </Text>
                        </Flex>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </div>
      )}
    </SectionCard>
  );
}
