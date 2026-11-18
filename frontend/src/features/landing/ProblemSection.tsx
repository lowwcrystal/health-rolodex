import { Box, Card, Container, Flex, Grid, Heading, Section, Text } from "@radix-ui/themes";

const FRAGMENTS = [
  { who: "Providers", holds: "Visit notes, diagnoses, and lab orders, each kept in a different office's system." },
  { who: "Pharmacies", holds: "Prescriptions and fill history, which your doctors rarely see." },
  { who: "Insurers", holds: "Coverage and networks, so you're left guessing which facility takes your plan." },
];

export function ProblemSection() {
  return (
    <Section size="3">
      <Container size="4" px="4">
        <Flex direction="column" align="center" gap="3" mb="7" style={{ textAlign: "center" }}>
          <Text size="2" weight="bold" color="indigo">
            THE PROBLEM
          </Text>
          <Heading size="8" style={{ maxWidth: 680 }}>
            Healthcare is fragmented.
          </Heading>
          <Text size="4" color="gray" style={{ maxWidth: 640 }}>
            You see multiple providers, use more than one pharmacy, and deal with an insurance company. Each of them holds one
            part of your story, and none of them has the whole thing.
          </Text>
        </Flex>
        <Grid columns={{ initial: "1", sm: "3" }} gap="4">
          {FRAGMENTS.map((f) => (
            <Card key={f.who} size="3" variant="surface">
              <Box mb="2">
                <Heading as="h3" size="4">
                  {f.who}
                </Heading>
              </Box>
              <Text color="gray">{f.holds}</Text>
            </Card>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
