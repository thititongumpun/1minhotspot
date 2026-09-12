import Link from "next/link";

/** Mono kicker above a display heading, with an optional "see all" link. Collapses to one column on mobile. */
export function SectionHead({
  kicker,
  heading,
  seeAllHref,
  seeAllLabel,
  as: Heading = "h2",
}: {
  kicker: string;
  heading: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="rule-left min-w-0">
        <p className="kicker">{kicker}</p>
        <Heading className="headline-wrap mt-1 font-display text-2xl font-bold text-fg sm:text-[28px]">
          {heading}
        </Heading>
      </div>
      {seeAllHref && seeAllLabel ? (
        <Link
          href={seeAllHref}
          className="shrink-0 py-1 text-base font-medium whitespace-nowrap text-hot hover:underline"
        >
          {seeAllLabel}
        </Link>
      ) : null}
    </div>
  );
}
