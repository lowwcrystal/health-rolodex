import { Badge, Button, Flex, Text } from "@radix-ui/themes";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/components/ui/format";
import { acceptsInsurance, directionsUrl, KIND_LABELS, type InsuranceFilter, type Place } from "./places";

function InsuranceBadge({ place, insurance }: { place: Place; insurance: InsuranceFilter }) {
  if (place.source === "mapbox") {
    return (
      <Badge color="gray" variant="soft">
        Insurance unknown · call to confirm
      </Badge>
    );
  }
  if (insurance !== "any" && insurance !== "mine") {
    return acceptsInsurance(place, insurance) ? (
      <Badge color="green">Accepts this plan</Badge>
    ) : (
      <Badge color="gray" variant="soft">Doesn't accept this plan</Badge>
    );
  }
  return place.inNetwork ? (
    <Badge color="green">In network</Badge>
  ) : (
    <Badge color="gray" variant="soft">
      Not in your active plans
    </Badge>
  );
}

interface Props {
  places: Place[];
  insurance: InsuranceFilter;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PlaceList({ places, insurance, selectedId, onSelect }: Props) {
  if (places.length === 0) {
    return <EmptyState message="No places match these filters. Try a wider distance or another plan." />;
  }
  return (
    <Flex direction="column" gap="2" role="list" aria-label="Nearby care">
      {places.map((p) => (
        <div
          key={p.id}
          role="listitem"
          className="place-item"
          data-selected={p.id === selectedId || undefined}
          tabIndex={0}
          onClick={() => onSelect(p.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(p.id);
            }
          }}
        >
          <Flex justify="between" align="start" gap="2">
            <Text weight="bold">{p.name}</Text>
            {p.distanceMi != null && (
              <Text size="2" color="gray" style={{ whiteSpace: "nowrap" }}>
                {p.distanceMi < 10 ? p.distanceMi.toFixed(1) : Math.round(p.distanceMi)} mi
              </Text>
            )}
          </Flex>
          <Text as="div" size="2" color="gray">
            {p.address}
          </Text>
          <Flex gap="2" wrap="wrap" mt="1">
            <Badge color={p.kind === "er" ? "red" : "indigo"} variant="soft">
              {KIND_LABELS[p.kind]}
            </Badge>
            <InsuranceBadge place={p} insurance={insurance} />
            {p.myVisits ? (
              <Badge color="indigo" variant="outline">
                Visited {p.myVisits}×{p.lastVisit ? ` · last ${formatDate(p.lastVisit)}` : ""}
              </Badge>
            ) : null}
          </Flex>
          {p.acceptedPlanNames && p.acceptedPlanNames.length > 0 && (
            <Text as="div" size="1" color="gray" mt="1" className="clamp-3">
              Accepts: {p.acceptedPlanNames.join(", ")}
            </Text>
          )}
          <Flex gap="2" mt="2" onClick={(e) => e.stopPropagation()}>
            {p.phone && (
              <Button asChild size="1" variant="soft">
                <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>Call</a>
              </Button>
            )}
            <Button asChild size="1" variant="soft" color="gray">
              <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer">
                Directions
              </a>
            </Button>
          </Flex>
        </div>
      ))}
    </Flex>
  );
}
