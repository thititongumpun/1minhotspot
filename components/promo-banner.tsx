import Image from "next/image";
import Link from "next/link";
import { promoSmallUrl, type Promotion } from "@/lib/types";
import { formatDate } from "./format";
import { PromoGate } from "./promo-gate";

/**
 * The sponsored placement: one strip under the header on every page, rendered
 * from the root layout. It wears the site's clothes (display-bold line, muted
 * date, the surface tone step) but the amber "โปรโมชัน" leads the line on every
 * variant so it never reads as news. One tap target to /promo/<slug>; the ×
 * beside it lives in PromoGate, which also hides the strip on /promo/* itself.
 *
 * Images are mixed ratio (square, 3:2, 9:16), so the thumb crops to 16:9 with
 * object-cover rather than letting the row height follow the picture. On a
 * phone the row is the two clamped summary lines plus the label: about 80px.
 */
export function PromoBanner({ promo }: { promo: Promotion }) {
  const image = promo.images[0];
  if (!image) return null;

  return (
    <PromoGate slug={promo.slug} startsAt={promo.startsAt} endsAt={promo.endsAt}>
      <Link
        href={`/promo/${promo.slug}`}
        aria-label={`โปรโมชัน: ${promo.summary}`}
        className="group flex min-h-11 min-w-0 flex-1 items-center gap-3 py-1 sm:gap-4 sm:py-1.5"
      >
        <Image
          src={promoSmallUrl(image.url)}
          alt={image.alt}
          width={112}
          height={63}
          sizes="112px"
          className="h-[54px] w-[96px] shrink-0 bg-ink object-cover sm:h-[63px] sm:w-[112px]"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-x-3 text-sm leading-tight">
            <span className="font-display font-bold text-hot">โปรโมชัน</span>
            {/* Short month: the long form ("6 พฤศจิกายน 2569") overran a 390px phone column. */}
            <span className="truncate text-muted tabular-nums">ถึง {formatDate(promo.endsAt, "short")}</span>
          </span>
          {/* line-clamp sets its own display; a `block` here would undo it. */}
          <span className="headline-wrap mt-0.5 line-clamp-2 font-display text-[0.9375rem] leading-snug font-bold text-fg transition-colors group-hover:text-hot sm:text-base">
            {promo.summary}
          </span>
        </span>
      </Link>
    </PromoGate>
  );
}
