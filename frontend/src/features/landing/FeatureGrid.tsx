import { ActivityLogIcon, FileTextIcon, HeartIcon, IdCardIcon, PersonIcon, Share1Icon } from "@radix-ui/react-icons";
import { Box, Container, Flex, Grid, Heading, Section, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

const FEATURES: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <HeartIcon />, title: "Care team", body: "Your primary care provider, every specialist you've seen, and your pharmacy, all in one list." },
  { icon: <IdCardIcon />, title: "Insurance", body: "Active and past plans, plus the facilities in your network." },
  { icon: <ActivityLogIcon />, title: "Conditions", body: "Allergies, chronic and genetic conditions, with the specialties recommended for each." },
  { icon: <PersonIcon />, title: "Visits", body: "A timeline of every appointment, with who you saw and where." },
  { icon: <FileTextIcon />, title: "Records", body: "Lab results, imaging, prescriptions and immunizations stored in one place." },
  { icon: <Share1Icon />, title: "You control sharing", body: "Mark a record shareable, then choose exactly which providers can see it." },
];

export function FeatureGrid() {
  return (
    <Section size="3" className="surface-tint">
      <Container size="4" px="4">
        <Flex direction="column" align="center" gap="3" mb="7" style={{ textAlign: "center" }}>
          <Text size="2" weight="bold" color="indigo">
            ONE ROLODEX
          </Text>
          <Heading size="8">Every piece, together.</Heading>
        </Flex>
        <Grid columns={{ initial: "1", sm: "2", md: "3" }} gap="6">
          {FEATURES.map((f) => (
            <Flex key={f.title} gap="4" align="start">
              <span className="icon-tile" style={{ background: "#fff" }}>
                {f.icon}
              </span>
              <Box>
                <Heading as="h3" size="4" mb="1">
                  {f.title}
                </Heading>
                <Text color="gray">{f.body}</Text>
              </Box>
            </Flex>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
