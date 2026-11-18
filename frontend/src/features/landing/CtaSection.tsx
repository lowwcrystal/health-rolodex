import { Button, Container, Flex, Heading, Link, Section, Text } from "@radix-ui/themes";
import { Link as RouterLink } from "react-router-dom";

export function CtaSection() {
  return (
    <Section size="3">
      <Container size="2" px="4">
        <Flex direction="column" align="center" gap="4" style={{ textAlign: "center" }}>
          <Heading size="7">Start your rolodex in a minute.</Heading>
          <Text color="gray">All you need is your name, date of birth and an email.</Text>
          <Button asChild size="3">
            <RouterLink to="/signup">Sign up free</RouterLink>
          </Button>
          <Text size="2" color="gray">
            Are you a doctor?{" "}
            <Link asChild>
              <RouterLink to="/login">Log in with your provider email</RouterLink>
            </Link>
          </Text>
        </Flex>
      </Container>
    </Section>
  );
}
