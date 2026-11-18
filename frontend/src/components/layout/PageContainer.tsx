import { Box, Container, Flex, Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { BackBar } from "./BackBar";

interface Props {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Show "Go back" in the top-left corner; the value is the fallback route. */
  backTo?: string;
  /** Use the whole window width instead of the centered max-width column (e.g. maps). */
  fullWidth?: boolean;
}

export function PageContainer({ title, subtitle, actions, children, backTo, fullWidth }: Props) {
  return (
    <>
      {backTo && <BackBar fallback={backTo} />}
      <Container size="4" px={fullWidth ? { initial: "4", md: "6" } : "4"} py={backTo ? "3" : "6"} className={fullWidth ? "container-full" : undefined}>
        <Flex justify="between" align={{ initial: "start", sm: "end" }} direction={{ initial: "column", sm: "row" }} gap="3" mb="5">
          <Box>
            <Heading size="7">{title}</Heading>
            {subtitle && (
              <Text as="p" color="gray" mt="1">
                {subtitle}
              </Text>
            )}
          </Box>
          {actions}
        </Flex>
        {children}
      </Container>
    </>
  );
}
