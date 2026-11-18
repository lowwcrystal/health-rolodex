import { ActivityLogIcon, CalendarIcon, FileTextIcon, Pencil1Icon, PersonIcon, PlusIcon, Share1Icon } from "@radix-ui/react-icons";
import { Badge, Button, Checkbox, DataList, Flex, Grid, Link, ScrollArea, Spinner, Text, TextArea } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { doctorApi } from "@/api/doctor";
import { useOptions } from "@/api/useOptions";
import { useAuth } from "@/auth/AuthContext";
import { PageContainer } from "@/components/layout/PageContainer";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCallout } from "@/components/ui/ErrorCallout";
import { FormDialog } from "@/components/ui/FormDialog";
import { FormField } from "@/components/ui/FormField";
import { OptionSelect } from "@/components/ui/OptionSelect";
import { SectionCard } from "@/components/ui/SectionCard";
import { ageFrom, capitalize, formatDate, providerOptionLabel, safeHref, todayISO } from "@/components/ui/format";
import { SubPanel } from "@/features/dashboard/CareTeamCard";
import {
  MAX_LEN_FILE_LINK,
  RECORD_TYPE_LABELS,
  RECORD_TYPES,
  type DoctorPatientDetail,
  type RecordType,
} from "@/types/schema";

const NOTES_MAX = 500;
const linkError = (v: string) =>
  !v.trim() ? undefined : v.length > MAX_LEN_FILE_LINK ? "Links must be at most 255 characters." : safeHref(v.trim()) ? undefined : "Enter a full link starting with https://";

type Detail = DoctorPatientDetail;
type Visit = Detail["visits"][number];

/** Log a new visit or edit one of mine: date (not in the future) + facility. */
function VisitDialog({ uid, visit, onSaved }: { uid: number; visit?: Visit; onSaved: () => Promise<void> }) {
  const options = useOptions();
  const [date, setDate] = useState("");
  const [facility, setFacility] = useState<string | null>(null);
  const dateError = !date ? undefined : date > todayISO() ? "Visit date can't be in the future." : undefined;
  return (
    <FormDialog
      title={visit ? "Edit visit" : "Log a visit"}
      trigger={
        visit ? (
          <Button size="1" variant="ghost">
            <Pencil1Icon /> Edit
          </Button>
        ) : (
          <Button size="1" variant="soft">
            <PlusIcon /> Log visit
          </Button>
        )
      }
      submitLabel={visit ? "Save" : "Log visit"}
      onOpen={() => {
        setDate(visit?.visit_date ?? todayISO());
        setFacility(visit ? String(visit.facility_id) : null);
      }}
      canSubmit={Boolean(date) && !dateError && facility !== null}
      onSubmit={async () => {
        const input = { visit_date: date, facility_id: Number(facility) };
        if (visit) await doctorApi.editVisit(visit.visit_id, input);
        else await doctorApi.logVisit(uid, input);
        await onSaved();
      }}
    >
      <FormField id="visit_date" label="Visit date" type="date" required max={todayISO()} value={date} onChange={setDate} error={dateError} />
      <OptionSelect id="facility" label="Facility" placeholder={options ? "Select a facility…" : "Loading…"} value={facility}
        options={(options?.facilities ?? []).map((f) => ({ value: String(f.facility_id), label: f.facility_name }))}
        onChange={setFacility} />
    </FormDialog>
  );
}

/** A small scrollable list of checkboxes. */
function CheckList({ items, selected, onToggle, empty }: {
  items: { id: number; label: string }[]; selected: number[]; onToggle: (id: number, on: boolean) => void; empty: string;
}) {
  if (items.length === 0) return <Text size="2" color="gray">{empty}</Text>;
  return (
    <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: 160 }}>
      <Flex direction="column" gap="2" pr="3">
        {items.map((i) => (
          <Text as="label" size="2" key={i.id}>
            <Flex gap="2" align="center">
              <Checkbox checked={selected.includes(i.id)} onCheckedChange={(c) => onToggle(i.id, c === true)} />
              {i.label}
            </Flex>
          </Text>
        ))}
      </Flex>
    </ScrollArea>
  );
}

function CreateDocumentDialog({ uid, me, myName, onSaved }: { uid: number; me: number; myName: string; onSaved: () => Promise<void> }) {
  const options = useOptions();
  const [recordType, setRecordType] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [shareWith, setShareWith] = useState<number[]>([]);
  const notesMax = NOTES_MAX - `From ${myName}: `.length;
  const doctors = (options?.providers ?? []).filter((p) => p.provider_id !== me);

  return (
    <FormDialog
      title="Create a document"
      description={`Saved in the patient's records as "From ${myName}". The patient sees it in My Documents and it's shared with you.`}
      trigger={
        <Button>
          <FileTextIcon /> Create document
        </Button>
      }
      submitLabel="Create"
      onOpen={() => {
        setRecordType(null);
        setNotes("");
        setLink("");
        setShareWith([]);
      }}
      canSubmit={recordType !== null && notes.length <= notesMax && !linkError(link)}
      onSubmit={async () => {
        await doctorApi.createDocument(uid, { record_type: recordType as RecordType, notes: notes.trim(), file_link: link.trim(), provider_ids: shareWith });
        await onSaved();
      }}
    >
      <OptionSelect id="record_type" label="Type" placeholder="Choose a type" value={recordType}
        options={RECORD_TYPES.map((t) => ({ value: t, label: RECORD_TYPE_LABELS[t] }))} onChange={setRecordType} />
      <Flex direction="column" gap="1">
        <Text as="label" htmlFor="doc_notes" size="2" weight="medium">
          Notes
        </Text>
        <TextArea id="doc_notes" rows={4} maxLength={notesMax} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Results, instructions or a summary for the patient" />
        <Text size="1" color="gray">
          {notes.length}/{notesMax}
        </Text>
      </Flex>
      <FormField id="doc_link" label="File link" optional type="url" maxLength={MAX_LEN_FILE_LINK} value={link} onChange={setLink}
        placeholder="https://…" error={linkError(link)} />
      <Flex direction="column" gap="1">
        <Text size="2" weight="medium">
          Also share with other doctors
        </Text>
        <CheckList items={doctors.map((d) => ({ id: d.provider_id, label: providerOptionLabel(d) }))} selected={shareWith}
          onToggle={(id, on) => setShareWith((s) => (on ? [...s, id] : s.filter((x) => x !== id)))} empty="Loading doctors…" />
      </Flex>
    </FormDialog>
  );
}

function ReferDialog({ uid, me, detail, onSaved }: { uid: number; me: number; detail: Detail; onSaved: () => Promise<void> }) {
  const options = useOptions();
  const [speciality, setSpeciality] = useState<string | null>(null);
  const [doctor, setDoctor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [records, setRecords] = useState<number[]>([]);

  const recommended = new Set(detail.recommended_specialities.map((s) => s.speciality_id));
  const specialities = [...(options?.specialities ?? [])].sort(
    (a, b) => Number(recommended.has(b.speciality_id)) - Number(recommended.has(a.speciality_id)) || a.speciality_name.localeCompare(b.speciality_name),
  );
  const chosen = specialities.find((s) => String(s.speciality_id) === speciality);
  const doctors = (options?.providers ?? []).filter((p) => p.provider_id !== me && chosen?.provider_ids.includes(p.provider_id));

  return (
    <FormDialog
      title="Refer to another doctor"
      description="Creates a referral in the patient's documents, shared with you and the doctor you choose."
      trigger={
        <Button variant="soft">
          <Share1Icon /> Refer
        </Button>
      }
      submitLabel="Send referral"
      onOpen={() => {
        setSpeciality(null);
        setDoctor(null);
        setReason("");
        setRecords([]);
      }}
      canSubmit={doctor !== null && reason.length <= 300}
      onSubmit={async () => {
        await doctorApi.refer(uid, { provider_id: Number(doctor), reason: reason.trim(), share_record_nos: records });
        await onSaved();
      }}
    >
      <OptionSelect id="speciality" label="Specialty" placeholder={options ? "Choose a specialty" : "Loading…"} value={speciality}
        options={specialities.map((s) => ({
          value: String(s.speciality_id),
          label: recommended.has(s.speciality_id) ? `${s.speciality_name} · recommended` : s.speciality_name,
        }))}
        onChange={(v) => {
          setSpeciality(v);
          setDoctor(null);
        }} />
      <OptionSelect id="refer_doctor" label="Doctor" placeholder={speciality ? (doctors.length ? "Choose a doctor" : "No other doctors") : "Choose a specialty first"}
        value={doctor} options={doctors.map((d) => ({ value: String(d.provider_id), label: providerOptionLabel(d) }))} onChange={setDoctor} />
      <Flex direction="column" gap="1">
        <Text as="label" htmlFor="refer_reason" size="2" weight="medium">
          Reason
        </Text>
        <TextArea id="refer_reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Why you're referring this patient" />
      </Flex>
      <Flex direction="column" gap="1">
        <Text size="2" weight="medium">
          Also send these documents
        </Text>
        <CheckList
          items={detail.documents.map((d) => ({ id: d.record_no, label: `${RECORD_TYPE_LABELS[d.record_type]} · ${formatDate(d.upload_date)}${d.notes ? ` · ${d.notes.slice(0, 40)}` : ""}` }))}
          selected={records}
          onToggle={(id, on) => setRecords((s) => (on ? [...s, id] : s.filter((x) => x !== id)))}
          empty="No documents shared with you yet."
        />
      </Flex>
    </FormDialog>
  );
}

/** A patient's profile as one of their doctors sees it: details, conditions, visits with you, documents shared with you. */
export function DoctorPatientPage() {
  const { id } = useParams();
  const uid = Number(id);
  const { session } = useAuth();
  const navigate = useNavigate();
  const me = session?.role === "doctor" ? session.provider : null;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await doctorApi.patient(uid));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this patient.");
    }
  }, [uid]);

  useEffect(() => {
    if (Number.isInteger(uid)) load();
    else setError("That patient doesn't exist.");
  }, [uid, load]);

  const docs = useMemo(() => detail?.documents ?? [], [detail]);

  if (error) {
    return (
      <PageContainer backTo="/doctor/dashboard" title="Patient">
        <ErrorCallout message={error} />
      </PageContainer>
    );
  }
  if (!detail || !me) {
    return (
      <Flex justify="center" py="9">
        <Spinner size="3" />
      </Flex>
    );
  }

  const p = detail.profile;
  const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");

  return (
    <PageContainer
      backTo="/doctor/dashboard"
      title={fullName}
      subtitle={`${ageFrom(p.dob)} years old${p.gender ? ` · ${capitalize(p.gender)}` : ""}`}
      actions={
        <Flex gap="2" wrap="wrap">
          <CreateDocumentDialog uid={uid} me={me.provider_id} myName={me.provider_name} onSaved={load} />
          <ReferDialog uid={uid} me={me.provider_id} detail={detail} onSaved={load} />
        </Flex>
      }
    >
      <div className="dashboard-grid">
        <SectionCard title="Patient" icon={<PersonIcon />}>
          <Flex direction="column" gap="3">
            <SubPanel label="DETAILS">
              <DataList.Root size="2">
                <DataList.Item>
                  <DataList.Label>Date of birth</DataList.Label>
                  <DataList.Value>{formatDate(p.dob)}</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Email</DataList.Label>
                  <DataList.Value>{p.email}</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Your role</DataList.Label>
                  <DataList.Value>{p.is_pcp ? <Badge color="indigo">Primary care provider</Badge> : "Treating doctor"}</DataList.Value>
                </DataList.Item>
              </DataList.Root>
            </SubPanel>
            {(p.is_pcp || docs.length > 0) && (
              <Flex justify="end">
                <ConfirmButton
                  label="Remove patient"
                  title={`Remove ${p.first_name} from your patients?`}
                  description="You'll stop being their PCP and lose access to the documents they shared with you. Your visit history with them stays."
                  onConfirm={async () => {
                    await doctorApi.removePatient(uid);
                    navigate("/doctor/dashboard");
                  }}
                />
              </Flex>
            )}
          </Flex>
        </SectionCard>

        <SectionCard title="Conditions" icon={<ActivityLogIcon />} count={detail.conditions.length}>
          {detail.conditions.length === 0 ? (
            <EmptyState message="No conditions on file." />
          ) : (
            <Flex direction="column" gap="2">
              {detail.conditions.map((c) => (
                <div key={c.condition_id} className="sub-panel">
                  <Flex justify="between" align="center" gap="2">
                    <Text weight="medium">{c.condition_name}</Text>
                    <Badge variant="soft" color={c.category === "allergy" ? "amber" : c.category === "genetic" ? "violet" : "indigo"}>
                      {capitalize(c.category)}
                    </Badge>
                  </Flex>
                  <Text as="div" size="1" color="gray">
                    Since {formatDate(c.diagnosed_date)}
                    {c.recommended_specialities ? ` · Recommended: ${c.recommended_specialities}` : ""}
                  </Text>
                </div>
              ))}
            </Flex>
          )}
        </SectionCard>

        <SectionCard title="Visits with you" icon={<CalendarIcon />} count={detail.visits.length}
          actions={<VisitDialog uid={uid} onSaved={load} />}>
          {detail.visits.length === 0 ? (
            <EmptyState message="No visits yet." />
          ) : (
            <Flex direction="column" gap="2">
              {detail.visits.map((v) => (
                <Flex key={v.visit_id} className="sub-panel" justify="between" align="center" gap="2">
                  <Flex direction="column">
                    <Text weight="medium">{formatDate(v.visit_date)}</Text>
                    <Text size="2" color="gray">
                      {v.facility_name}
                    </Text>
                  </Flex>
                  <VisitDialog uid={uid} visit={v} onSaved={load} />
                </Flex>
              ))}
            </Flex>
          )}
        </SectionCard>

        <SectionCard title="Documents shared with you" icon={<FileTextIcon />} count={docs.length}>
          {docs.length === 0 ? (
            <EmptyState message="This patient hasn't shared any documents with you." />
          ) : (
            <Grid columns="1" gap="2">
              {docs.map((d) => {
                const href = safeHref(d.file_link);
                return (
                  <div key={d.record_no} className="sub-panel">
                    <Flex justify="between" align="center" gap="2">
                      <Badge variant="soft">{RECORD_TYPE_LABELS[d.record_type]}</Badge>
                      <Text size="1" color="gray">
                        {formatDate(d.upload_date)}
                      </Text>
                    </Flex>
                    {d.notes && (
                      <Text as="div" size="2" mt="1" className="clamp-4">
                        {d.notes}
                      </Text>
                    )}
                    {href && (
                      <Link href={href} target="_blank" rel="noopener noreferrer" size="2">
                        Open file
                      </Link>
                    )}
                  </div>
                );
              })}
            </Grid>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}
