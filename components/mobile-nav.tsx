"use client";

import { usePathname } from "next/navigation";
import { NavLinks } from "./nav-links";

/** Mobile disclosure — native <details>, keyboard-operable with no JS. The
 *  header persists across client navigations, so key it on the pathname:
 *  React remounts it closed after every route change. */
export function MobileNav() {
  return (
    <details key={usePathname()} className="lg:hidden">
      <summary className="flex h-11 w-11 list-none flex-col items-center justify-center gap-[5px] [&::-webkit-details-marker]:hidden">
        <span className="sr-only">เมนู</span>
        <span aria-hidden className="block h-px w-5 bg-fg" />
        <span aria-hidden className="block h-px w-5 bg-fg" />
        <span aria-hidden className="block h-px w-5 bg-fg" />
      </summary>
      <nav aria-label="เมนู" className="absolute inset-x-0 top-full border-b border-hairline bg-ink">
        <NavLinks
          ulClassName="container-hot py-2"
          liClassName="border-t border-hairline first:border-t-0"
          linkClassName="block py-3 text-base whitespace-nowrap text-fg"
        />
      </nav>
    </details>
  );
}
