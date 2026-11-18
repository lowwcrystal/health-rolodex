import { Share1Icon } from "@radix-ui/react-icons";
import { Badge, Box, Link, Table, Text } from "@radix-ui/themes";
import { EmptyState } from "@/components/ui/EmptyState";
import { OptionSelect } from "@/components/ui/OptionSelect";
import { SectionCard } from "@/components/ui/SectionCard";
import { capitalize, formatDate, safeHref } from "@/components/ui/format";
import { DOCUMENT_KINDS, RECORD_TYPES, RECORD_TYPE_LABELS, parseDocumentKind, type RecordType, type SharedRecord } from "@/types/schema";

interface Props {
  records: SharedRecord[];
  recordType: RecordType | null;
  onRecordTypeChange: (value: RecordType | null) => void;
}

export function SharedRecordsTable({ records, recordType, onRecordTypeChange }: Props) {
  return (
    <SectionCard title="Records shared with you" icon={<Share1Icon />} count={records.length} wide>
      <Box mb="3" style={{ maxWidth: 260 }}>
        <OptionSelect
          id="record_type_filter"
          label="Filter by record type"
          placeholder="All types"
          value={recordType}
          options={RECORD_TYPES.map((t) => ({ value: t, label: RECORD_TYPE_LABELS[t] }))}
          onChange={(v) => onRecordTypeChange(v as RecordType | null)}
        />
      </Box>
      {records.length === 0 ? (
        <EmptyState message="No patients have shared records of this type with you." />
      ) : (
        <div className="table-scroll">
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Patient</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Date of birth</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Uploaded</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Notes</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {records.map((r) => {
                const doc = parseDocumentKind(r.record_type, r.notes);
                const href = safeHref(r.file_link);
                return (
                <Table.Row key={`${r.user_id}-${r.record_no}`}>
                  <Table.RowHeaderCell>
                    {r.first_name} {r.last_name}
                  </Table.RowHeaderCell>
                  <Table.Cell>{formatDate(r.dob)}</Table.Cell>
                  <Table.Cell>
                    <Badge variant="soft">
                      {DOCUMENT_KINDS[doc.kind]?.label ?? RECORD_TYPE_LABELS[r.record_type]}
                      {doc.side ? ` · ${capitalize(doc.side)}` : ""}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{formatDate(r.upload_date)}</Table.Cell>
                  <Table.Cell style={{ maxWidth: 360 }}>
                    <Text as="div" size="2">{doc.notes ?? "—"}</Text>
                    {href && (
                      <Link href={href} target="_blank" rel="noopener noreferrer" size="1">
                        Open file
                      </Link>
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
