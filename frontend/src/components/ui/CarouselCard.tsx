import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { IconButton } from "@radix-ui/themes";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { SectionCard } from "./SectionCard";

interface Props {
  title: string;
  icon: ReactNode;
  /** Number of tiles; 0 shows the empty state. */
  count: number;
  emptyMessage: string;
  /** Accessible name for the scrolling region. */
  label: string;
  /** The tiles; each should be a `.carousel-tile` element. */
  children: ReactNode;
}

/** A full-width SectionCard whose content is a swipeable row of square tiles, with ‹ › arrows in the header. */
export function CarouselCard({ title, icon, count, emptyMessage, label, children }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, count]);

  const scrollByTile = (direction: 1 | -1) => {
    const el = trackRef.current;
    const tile = el?.querySelector<HTMLElement>(".carousel-tile");
    if (!el || !tile) return;
    el.scrollBy({ left: direction * (tile.offsetWidth + 12), behavior: "smooth" });
  };

  const arrows =
    count > 0 ? (
      <>
        <IconButton variant="soft" color="gray" radius="full" disabled={!canPrev} onClick={() => scrollByTile(-1)} aria-label={`Previous in ${label}`}>
          <ChevronLeftIcon />
        </IconButton>
        <IconButton variant="soft" color="gray" radius="full" disabled={!canNext} onClick={() => scrollByTile(1)} aria-label={`Next in ${label}`}>
          <ChevronRightIcon />
        </IconButton>
      </>
    ) : null;

  return (
    <SectionCard title={title} icon={icon} count={count || undefined} wide actions={arrows}>
      {count === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div ref={trackRef} className="carousel-track" role="region" aria-label={label} tabIndex={0}>
          {children}
        </div>
      )}
    </SectionCard>
  );
}
