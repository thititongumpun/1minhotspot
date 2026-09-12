import Image from "next/image";
import Link from "next/link";
import { MobileNav } from "./mobile-nav";
import { NAV } from "./nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-ink">
      <div className="container-hot flex h-14 items-center gap-3 lg:h-16 lg:gap-6">
        {/* Wordmark: the badge, then the numeral as the graphic and the mono
            :60 as the signature. Thai carries no case and rejects tracking, so
            the type leans on the amber numeral, not uppercase letterspacing.
            The badge repeats the name in its own art — at 32px that reads as a
            mark, not as the words twice, so the type still carries the brand. */}
        <Link
          href="/"
          aria-label="สรุปข่าวร้อนใน 1 นาที"
          className="flex shrink-0 items-center gap-2 whitespace-nowrap"
        >
          <Image
            src="/logo.png"
            alt="สรุปข่าวร้อนใน 1 นาที"
            width={512}
            height={512}
            // Without sizes, next/image fetches a 640px render for a 36px slot.
            sizes="36px"
            // In the sticky header on every route — never below the fold.
            loading="eager"
            className="h-8 w-8 shrink-0 rounded-full lg:h-9 lg:w-9"
          />
          <span aria-hidden className="flex items-baseline gap-1 sm:gap-1.5">
            <span className="font-display text-[13px] leading-none font-semibold sm:text-[15px] lg:text-[17px]">
              สรุปข่าวร้อนใน
            </span>
            <span className="font-display text-xl leading-none font-bold text-hot sm:text-2xl lg:text-[26px]">
              1
            </span>
            <span className="font-display text-[13px] leading-none font-semibold sm:text-[15px] lg:text-[17px]">
              นาที
            </span>
            <span className="font-mono text-[10px] leading-none text-muted sm:text-[11px]">
              :60
            </span>
          </span>
        </Link>

        <nav aria-label="เมนู" className="hidden min-w-0 flex-1 lg:block">
          <ul className="flex items-center gap-5 xl:gap-6">
            {NAV.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block py-3 text-[15px] whitespace-nowrap text-muted transition-colors hover:text-hot"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3 lg:ml-0">
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
