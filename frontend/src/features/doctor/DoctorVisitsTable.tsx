import { CalendarIcon } from "@radix-ui/react-icons";
import { Table } from "@radix-ui/themes";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDate } from "@/components/ui/format";
import type { DoctorVisit } from "@/types/schema";

export function DoctorVisitsTable({ visits }: { visits: DoctorVisit[] }) {
  return (
    <SectionCard title="Your visits" icon={<CalendarIcon />} count={visits.length} wide>
      {visits.length === 0 ? (
        <EmptyState message="No visits recorded." />
      ) : (
        <div className="table-scroll">
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Patient</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Facility</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {visits.map((v) => (
                <Table.Row key={v.visit_id}>
                  <Table.RowHeaderCell>{formatDate(v.visit_date)}</Table.RowHeaderCell>
                  <Table.Cell>
                    {v.first_name} {v.last_name}
                  </Table.Cell>
                  <Table.Cell>{v.facility_name}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </div>
      )}
    </SectionCard>
  );
}
