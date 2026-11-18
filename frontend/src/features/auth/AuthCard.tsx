import { Box, Card, Container, Flex, Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { BackBar } from "@/components/layout/BackBar";

interface Props {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
  size?: "1" | "2";
  /** Center the title and subtitle (used on login). */
  centered?: boolean;
  /** Fallback route for the top-left "Go back" button. */
  backTo?: string;
}

/** Centered card on the blue-tinted background shared by login, signup and the doctor portal picker. */
export function AuthCard({ title, subtitle, footer, children, size = "1", centered = false, backTo = "/" }: Props) {
  return (
    <Box className="auth-wrap">
      <div className="auth-back">
        <BackBar fallback={backTo} />
      </div>
      <Flex flexGrow="1" align="center" justify="center" py="9" px="4">
        <Container size={size} style={{ width: "100%" }}>
          <Card size="4">
            <Flex
              direction="column"
              gap="1"
              mb="5"
              align={centered ? "center" : "start"}
              style={centered ? { textAlign: "center" } : undefined}
            >
              <Heading size="6">{title}</Heading>
              <Text color="gray">{subtitle}</Text>
            </Flex>
            {children}
            <Flex justify="center" mt="5">
              <Text size="2" color="gray">
                {footer}
              </Text>
            </Flex>
          </Card>
        </Container>
      </Flex>
    </Box>
  );
}
