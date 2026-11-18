import { ExclamationTriangleIcon, InfoCircledIcon, HeartIcon } from "@radix-ui/react-icons";
import { Badge, Flex, Text } from "@radix-ui/themes";
import { CarouselCard } from "@/components/ui/CarouselCard";
import type { Insight } from "@/types/schema";

function PatternTile({ insight }: { insight: Insight }) {
  const attention = insight.level === "attention";
  return (
    <div className="carousel-tile" data-level={insight.level}>
      <Flex align="center" justify="between" gap="2">
        <span
          className="icon-tile"
          style={attention ? { background: "var(--red-4)", color: "var(--red-11)" } : undefined}
        >
          {attention ? <ExclamationTriangleIcon /> : <InfoCircledIcon />}
        </span>
        <Badge color={attention ? "red" : "indigo"} variant="soft">
          {attention ? "Needs attention" : "Insight"}
        </Badge>
      </Flex>
      <Text weight="bold" className="clamp-3">
        {insight.title}
      </Text>
      <Text size="2" color="gray" className="clamp-4">
        {insight.detail}
      </Text>
    </div>
  );
}

/** Rule-based health patterns (api/insights.py) as a swipeable row of square tiles. */
export function HealthPatternsCard({ insights }: { insights: Insight[] }) {
  return (
    <CarouselCard
      title="Current health patterns identified"
      icon={<HeartIcon />}
      count={insights.length}
      emptyMessage="No patterns yet. Add conditions, visits and plans to see insights."
      label="Health patterns"
    >
      {insights.map((i) => (
        <PatternTile key={i.title} insight={i} />
      ))}
    </CarouselCard>
  );
}
