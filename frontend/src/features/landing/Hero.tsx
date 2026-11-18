import { ArrowRightIcon, FileTextIcon, HeartIcon, IdCardIcon } from "@radix-ui/react-icons";
import { Box, Button, Card, Container, Flex, Grid, Heading, Section, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

/** One "rolodex card" in the hero illustration (illustrative copy, not real data). */
function RolodexCard({ icon, label, title, detail, offset }: { icon: ReactNode; label: string; title: string; detail: string; offset: number }) {
  return (
    <Card size="2" className="rolodex-card" style={{ top: offset, transform: `rotate(${(offset / 40 - 1) * 2}deg)` }}>
      <Flex gap="3" align="center">
        <span className="icon-tile">{icon}</span>
        <Box>
          <Text as="div" size="1" color="indigo" weight="medium">
            {label}
          </Text>
          <Text as="div" size="3" weight="bold">
            {title}
          </Text>
          <Text as="div" size="2" color="gray">
            {detail}
          </Text>
        </Box>
      </Flex>
    </Card>
  );
}

export function Hero() {
  return (
    <Section className="hero" size={{ initial: "2", md: "3" }}>
      <Container size="4" px="4">
        <Grid columns={{ initial: "1", md: "2" }} gap="8" align="center">
          <Flex direction="column" gap="5">
            <Heading size={{ initial: "8", md: "9" }} style={{ lineHeight: 1.1 }}>
              Your whole health story, in one place.
            </Heading>
            <Text size="4" color="gray" style={{ maxWidth: 520 }}>
              Doctors, pharmacies and insurers each hold one piece of your care. Health Rolodex brings your providers,
              plans, conditions, visits and records together, and you decide who sees what.
            </Text>
            <Flex gap="3" wrap="wrap">
              <Button asChild size="3">
                <RouterLink to="/signup">
                  Create your rolodex <ArrowRightIcon />
                </RouterLink>
              </Button>
            </Flex>
          </Flex>

          <Box className="rolodex-stack" aria-hidden="true">
            <RolodexCard icon={<HeartIcon />} label="PRIMARY CARE" title="Your PCP" detail="Internal medicine" offset={0} />
            <RolodexCard icon={<IdCardIcon />} label="INSURANCE" title="Active plan" detail="12 in-network facilities" offset={80} />
            <RolodexCard icon={<FileTextIcon />} label="RECORDS" title="Lab result" detail="Shared with 2 providers" offset={160} />
          </Box>
        </Grid>
      </Container>
    </Section>
  );
}
