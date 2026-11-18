import { PersonIcon } from "@radix-ui/react-icons";
import { Avatar, Badge, Flex, Text } from "@radix-ui/themes";
import { CarouselCard } from "@/components/ui/CarouselCard";
import { RatingBadge } from "@/components/ui/RatingBadge";
import type { RecommendedDoctor } from "@/types/schema";

function DoctorTile({ doctor: d }: { doctor: RecommendedDoctor }) {
  return (
    <div className="carousel-tile" data-highlight={d.is_pcp || undefined}>
      <Flex align="center" justify="between" gap="2">
        <Avatar size="3" radius="full" fallback={d.provider_name.replace(/^Dr\.\s*/, "").charAt(0)} />
        {d.is_pcp ? (
          <Badge color="indigo">Your PCP</Badge>
        ) : d.seen_before ? (
          <Badge color="green" variant="soft">
            Seen before
          </Badge>
        ) : (
          <Badge color="gray" variant="soft">
            New to you
          </Badge>
        )}
      </Flex>
      <Text weight="bold">{d.provider_name}</Text>
      <Flex gap="2" wrap="wrap" align="center">
        {d.specialities.split(", ").map((s) => (
          <Badge key={s} variant="soft">
            {s}
          </Badge>
        ))}
        <RatingBadge rating={d.rating} />
      </Flex>
      <Text size="2" color="gray" className="clamp-4" mt="auto">
        Recommended for {d.for_conditions}
      </Text>
    </div>
  );
}

/** Specialists for the user's diagnosed conditions, as a swipeable row of square tiles (same style as health patterns). */
export function RecommendedDoctorsCard({ doctors }: { doctors: RecommendedDoctor[] }) {
  return (
    <CarouselCard
      title="Recommended doctors"
      icon={<PersonIcon />}
      count={doctors.length}
      emptyMessage="Add a diagnosis to get specialist recommendations."
      label="Recommended doctors"
    >
      {doctors.map((d) => (
        <DoctorTile key={d.provider_id} doctor={d} />
      ))}
    </CarouselCard>
  );
}
