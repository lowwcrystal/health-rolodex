import { CalendarIcon } from "@radix-ui/react-icons";
import { Table, Text } from "@radix-ui/themes";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDate } from "@/components/ui/format";
import type { Visit } from "@/types/schema";

export function VisitsTable({ visits }: { visits: Visit[] }) {
  return (
    <SectionCard title="Visits" icon={<CalendarIcon />} count={visits.length} wide>
      {visits.length === 0 ? (
        <EmptyState message="No visits recorded." />
      ) : (
        <div className="table-scroll">
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Provider</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Facility</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {visits.map((v) => (
                <Table.Row key={v.visit_id}>
                  <Table.RowHeaderCell>{formatDate(v.visit_date)}</Table.RowHeaderCell>
                  <Table.Cell>{v.provider_name}</Table.Cell>
                  <Table.Cell>
                    <Text as="div">{v.facility_name}</Text>
                    <Text as="div" size="1" color="gray">
                      {v.facility_address}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </div>
      )}
    </SectionCard>
  );
}
