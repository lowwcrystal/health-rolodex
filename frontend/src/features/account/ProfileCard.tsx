import { PersonIcon } from "@radix-ui/react-icons";
import { DataList } from "@radix-ui/themes";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDate } from "@/components/ui/format";
import type { Profile } from "@/types/schema";

export function ProfileCard({ profile }: { profile: Profile }) {
  const fullName = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ");
  return (
    <SectionCard title="Profile" icon={<PersonIcon />}>
      <DataList.Root>
        <DataList.Item>
          <DataList.Label>Name</DataList.Label>
          <DataList.Value>{fullName}</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Username</DataList.Label>
          <DataList.Value>{profile.username}</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Email</DataList.Label>
          <DataList.Value>{profile.email}</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Date of birth</DataList.Label>
          <DataList.Value>{formatDate(profile.dob)}</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Gender</DataList.Label>
          <DataList.Value>{profile.gender ?? "—"}</DataList.Value>
        </DataList.Item>
      </DataList.Root>
    </SectionCard>
  );
}
