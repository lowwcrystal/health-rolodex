import { Flex } from "@radix-ui/themes";
import { BackButton } from "@/components/ui/BackButton";

/** "Go back" pinned to the top-left of the page, directly under the header (outside any centered container). */
export function BackBar({ fallback }: { fallback: string }) {
  return (
    <Flex px="4" pt="3" justify="start" className="no-print">
      <BackButton fallback={fallback} />
    </Flex>
  );
}
