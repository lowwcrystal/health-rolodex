import { Flex, Text } from "@radix-ui/themes";

export function EmptyState({ message }: { message: string }) {
  return (
    <Flex align="center" justify="center" p="4" style={{ borderRadius: "var(--radius-3)", border: "1px dashed var(--gray-6)" }}>
      <Text size="2" color="gray">
        {message}
      </Text>
    </Flex>
  );
}
