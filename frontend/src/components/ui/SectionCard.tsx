import { Badge, Card, Flex, Heading } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface Props {
  title: string;
  icon: ReactNode;
  count?: number;
  children: ReactNode;
  /** Span the whole dashboard grid row (for tables). */
  wide?: boolean;
  /** Controls shown at the right end of the header row (e.g. carousel arrows). */
  actions?: ReactNode;
}

export function SectionCard({ title, icon, count, children, wide, actions }: Props) {
  return (
    <Card size="3" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <Flex align="center" gap="3" mb="4">
        <span className="icon-tile">{icon}</span>
        <Heading as="h2" size="4">
          {title}
        </Heading>
        {count !== undefined && (
          <Badge variant="soft" radius="full">
            {count}
          </Badge>
        )}
        {actions && <Flex ml="auto" gap="2">{actions}</Flex>}
      </Flex>
      {children}
    </Card>
  );
}
