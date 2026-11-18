import { Card, Flex, Select, Switch, Text } from "@radix-ui/themes";
import type { CarePlan } from "@/types/schema";
import type { PlaceKind } from "./mapbox";
import { KIND_LABELS, type Filters, type InsuranceFilter } from "./places";

const DISTANCES = [1, 3, 5, 10, 25];
const KINDS: PlaceKind[] = ["er", "hospital", "urgent_care"];

interface Props {
  filters: Filters;
  plans: CarePlan[];
  hasActivePlan: boolean;
  /** Distance only means something once the user has searched a location (address, ZIP or "Use my location"). */
  hasLocation: boolean;
  onChange: (next: Filters) => void;
}

/** Insurance (from accepts/enrolledin), type, distance and visit filters for the care finder. */
export function CareFilters({ filters, plans, hasActivePlan, hasLocation, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const setInsurance = (value: string) => {
    const insurance = value as InsuranceFilter;
    // Choosing an insurance filter hides places whose insurance we don't know; the user can turn them back on.
    set({ insurance, includeUnknown: insurance === "any" ? true : false });
  };

  const typeValue = filters.kinds.length === 1 ? filters.kinds[0] : "all";
  const setType = (v: string) => set({ kinds: v === "all" ? [...KINDS] : [v as PlaceKind] });

  const mine = plans.filter((p) => p.is_mine);
  const others = plans.filter((p) => !p.is_mine);

  return (
    <Card size="2">
      <Flex direction="column" gap="3">
        <Flex gap="4" wrap="wrap" align="end" pb={hasLocation ? "0" : "3"}>
          <Flex direction="column" gap="1" style={{ minWidth: 240, flex: "1 1 260px" }}>
            <Text as="label" htmlFor="insurance-filter" size="2" weight="medium">
              Insurance
            </Text>
            <Select.Root value={filters.insurance} onValueChange={setInsurance}>
              <Select.Trigger id="insurance-filter" className="option-select-trigger" />
              <Select.Content position="popper" side="bottom" sideOffset={4} className="option-select-content">
                <Select.Item value="any">Any insurance</Select.Item>
                <Select.Item value="mine" disabled={!hasActivePlan}>
                  Accepts my active plan{hasActivePlan ? "" : " (none on file)"}
                </Select.Item>
                {mine.length > 0 && (
                  <Select.Group>
                    <Select.Separator />
                    <Select.Label>Your plans</Select.Label>
                    {mine.map((p) => (
                      <Select.Item key={p.plan_id} value={`plan:${p.plan_id}`}>
                        {p.plan_name}
                        {p.is_mine_active ? "" : " (expired)"}
                      </Select.Item>
                    ))}
                  </Select.Group>
                )}
                <Select.Separator />
                <Select.Group>
                  <Select.Label>Other plans</Select.Label>
                  {others.map((p) => (
                    <Select.Item key={p.plan_id} value={`plan:${p.plan_id}`}>
                      {p.plan_name}
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Flex>

          <Flex direction="column" gap="1" className="filter-field">
            <Text as="label" htmlFor="distance-filter" size="2" weight="medium">
              Distance
            </Text>
            <Select.Root
              value={filters.maxMiles == null ? "any" : String(filters.maxMiles)}
              onValueChange={(v) => set({ maxMiles: v === "any" ? null : Number(v) })}
              disabled={!hasLocation}
            >
              <Select.Trigger
                id="distance-filter"
                style={{ minWidth: 130 }}
                title={hasLocation ? undefined : "Enter an address or ZIP code first"}
              />
              <Select.Content position="popper" side="bottom" sideOffset={4}>
                {DISTANCES.map((d) => (
                  <Select.Item key={d} value={String(d)}>
                    Within {d} mi
                  </Select.Item>
                ))}
                <Select.Item value="any">Any distance</Select.Item>
              </Select.Content>
            </Select.Root>
            {!hasLocation && (
              <Text size="1" color="gray" className="filter-hint">
                Enter an address or ZIP first
              </Text>
            )}
          </Flex>

          <Flex direction="column" gap="1">
            <Text as="label" htmlFor="type-filter" size="2" weight="medium">
              Type
            </Text>
            <Select.Root value={typeValue} onValueChange={setType}>
              <Select.Trigger id="type-filter" style={{ minWidth: 170 }} />
              <Select.Content position="popper" side="bottom" sideOffset={4}>
                <Select.Item value="all">All types</Select.Item>
                {KINDS.map((k) => (
                  <Select.Item key={k} value={k}>
                    {KIND_LABELS[k]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
        </Flex>

        <Flex gap="5" wrap="wrap">
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Switch checked={filters.visitedOnly} onCheckedChange={(visitedOnly) => set({ visitedOnly })} />
              Only places I've been
            </Flex>
          </Text>
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Switch checked={filters.includeUnknown} onCheckedChange={(includeUnknown) => set({ includeUnknown })} />
              Include places with unknown insurance
            </Flex>
          </Text>
        </Flex>

        {filters.insurance !== "any" && (
          <Text size="1" color="gray">
            Insurance data comes from Health Rolodex facilities. ERs must treat you whatever your insurance; in a
            life-threatening emergency, go to the nearest ER or call 911.
          </Text>
        )}
      </Flex>
    </Card>
  );
}
