import { MagnifyingGlassIcon, PersonIcon } from "@radix-ui/react-icons";
import { Badge, Flex, Select, Table, Text, TextField } from "@radix-ui/themes";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doctorApi } from "@/api/doctor";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/SectionCard";
import { ageFrom, formatDate, todayISO } from "@/components/ui/format";
import type { DoctorPatient } from "@/types/schema";

type Relationship = "all" | "pcp" | "seen" | "shared" | "past";
type LastSeen = "any" | "30" | "90" | "365" | "over365" | "never";
type Sort = "recent" | "oldest" | "az" | "za" | "docs";

const RELATIONSHIPS: [Relationship, string][] = [
  ["all", "All patients"],
  ["pcp", "My PCP patients"],
  ["seen", "Seen by me"],
  ["shared", "Shared documents with me"],
  ["past", "Past patients"],
];
const LAST_SEEN: [LastSeen, string][] = [
  ["any", "Any time"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
  ["365", "Last year"],
  ["over365", "Over a year ago"],
  ["never", "Never seen"],
];
const SORTS: [Sort, string][] = [
  ["recent", "Last seen (newest)"],
  ["oldest", "Last seen (oldest)"],
  ["az", "Name A–Z"],
  ["za", "Name Z–A"],
  ["docs", "Most documents"],
];

function daysSince(iso: string): number {
  return Math.floor((Date.parse(todayISO()) - Date.parse(iso.slice(0, 10))) / 86_400_000);
}

function matches(p: DoctorPatient, rel: Relationship, seen: LastSeen, q: string): boolean {
  if (q && !`${p.first_name} ${p.last_name}`.toLowerCase().includes(q)) return false;
  if (rel === "pcp" && !p.is_pcp) return false;
  if (rel === "seen" && p.visit_count === 0) return false;
  if (rel === "shared" && p.shared_count === 0) return false;
  if (rel === "past" && (p.is_pcp || p.shared_count > 0)) return false;
  if (seen === "never") return p.last_seen === null;
  if (seen !== "any") {
    if (!p.last_seen) return false;
    const days = daysSince(p.last_seen);
    return seen === "over365" ? days > 365 : days <= Number(seen);
  }
  return true;
}

const byName = (a: DoctorPatient, b: DoctorPatient) =>
  a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);

function compare(sort: Sort) {
  return (a: DoctorPatient, b: DoctorPatient) => {
    switch (sort) {
      case "az":
        return byName(a, b);
      case "za":
        return byName(b, a);
      case "docs":
        return b.shared_count - a.shared_count || byName(a, b);
      case "oldest":
        return (a.last_seen ?? "9999").localeCompare(b.last_seen ?? "9999") || byName(a, b);
      default:
        return (b.last_seen ?? "").localeCompare(a.last_seen ?? "") || byName(a, b);
    }
  };
}

function FilterSelect<T extends string>({ id, label, value, options, onChange }: {
  id: string; label: string; value: T; options: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <Flex direction="column" gap="1">
      <Text as="label" htmlFor={id} size="2" weight="medium">
        {label}
      </Text>
      <Select.Root value={value} onValueChange={(v) => onChange(v as T)}>
        <Select.Trigger id={id} style={{ minWidth: 180 }} />
        <Select.Content position="popper" side="bottom" sideOffset={4}>
          {options.map(([v, l]) => (
            <Select.Item key={v} value={v}>
              {l}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Flex>
  );
}

/** The doctor's patients, with search, relationship / last-seen filters and sorting. Click a row to open the profile. */
export function PatientsTable({ patients, onChanged }: { patients: DoctorPatient[]; onChanged: () => Promise<void> }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [rel, setRel] = useState<Relationship>("all");
  const [seen, setSeen] = useState<LastSeen>("any");
  const [sort, setSort] = useState<Sort>("recent");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => matches(p, rel, seen, q)).sort(compare(sort));
  }, [patients, query, rel, seen, sort]);

  return (
    <SectionCard title="Your patients" icon={<PersonIcon />} count={patients.length} wide>
      <Flex gap="4" wrap="wrap" align="end" mb="4">
        <Flex direction="column" gap="1" style={{ flex: "1 1 220px" }}>
          <Text as="label" htmlFor="patient-search" size="2" weight="medium">
            Search
          </Text>
          <TextField.Root id="patient-search" placeholder="Patient name" maxLength={61} value={query}
            onChange={(e) => setQuery(e.target.value)}>
            <TextField.Slot>
              <MagnifyingGlassIcon />
            </TextField.Slot>
          </TextField.Root>
        </Flex>
        <FilterSelect id="patient-rel" label="Show" value={rel} options={RELATIONSHIPS} onChange={setRel} />
        <FilterSelect id="patient-seen" label="Last seen" value={seen} options={LAST_SEEN} onChange={setSeen} />
        <FilterSelect id="patient-sort" label="Sort by" value={sort} options={SORTS} onChange={setSort} />
      </Flex>

      {visible.length === 0 ? (
        <EmptyState message={patients.length ? "No patients match these filters." : "No patients linked to you yet."} />
      ) : (
        <div className="table-scroll">
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Patient</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Age</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Last seen</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Visits</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Documents</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {visible.map((p) => (
                <Table.Row key={p.user_id} className="clickable-row" tabIndex={0}
                  onClick={() => navigate(`/doctor/patients/${p.user_id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/doctor/patients/${p.user_id}`)}>
                  <Table.RowHeaderCell>
                    <Flex align="center" gap="2" wrap="wrap">
                      <Text weight="medium">
                        {p.last_name}, {p.first_name}
                      </Text>
                      {p.is_pcp && <Badge color="indigo">Your PCP patient</Badge>}
                    </Flex>
                  </Table.RowHeaderCell>
                  <Table.Cell>{ageFrom(p.dob)}</Table.Cell>
                  <Table.Cell>{p.last_seen ? formatDate(p.last_seen) : <Text color="gray">Never</Text>}</Table.Cell>
                  <Table.Cell>{p.visit_count}</Table.Cell>
                  <Table.Cell>{p.shared_count}</Table.Cell>
                  <Table.Cell onClick={(e) => e.stopPropagation()}>
                    {(p.is_pcp || p.shared_count > 0) && (
                      <ConfirmButton
                        label="Remove"
                        title={`Remove ${p.first_name} ${p.last_name}?`}
                        description="You'll stop being their PCP and lose access to the documents they shared with you. Your visit history with them stays."
                        onConfirm={async () => {
                          await doctorApi.removePatient(p.user_id);
                          await onChanged();
                        }}
                      />
                    )}
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
