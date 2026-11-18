import { StarFilledIcon } from "@radix-ui/react-icons";
import { Flex, Text } from "@radix-ui/themes";
import { formatRating } from "./format";

/** A doctor's provider.rating (1.0–5.0) as a yellow ★ and the number, inline next to a name; nothing when NULL. */
export function RatingBadge({ rating, size = "2" }: { rating: number | null | undefined; size?: "1" | "2" | "3" }) {
  if (rating == null) return null;
  return (
    <Flex as="span" display="inline-flex" align="center" gap="1" flexShrink="0" aria-label={`Rated ${formatRating(rating)} out of 5`}>
      <StarFilledIcon className="rating-star" aria-hidden />
      <Text size={size} weight="medium">
        {formatRating(rating)}
      </Text>
    </Flex>
  );
}
