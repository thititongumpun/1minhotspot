"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";

/** The primary menu with the current page marked — aria-current plus an amber
 *  underline, so a reader always knows which section they are in. Client
 *  only for usePathname(); the header stays a server component around it. */
export function NavLinks({
  ulClassName,
  liClassName,
  linkClassName,
}: {
  ulClassName: string;
  liClassName?: string;
  linkClassName: string;
}) {
  const pathname = usePathname();
  return (
    <ul className={ulClassName}>
      {NAV.map(({ href, label }) => {
        const current = pathname === href;
        return (
          <li key={href} className={liClassName}>
            <Link
              href={href}
              aria-current={current ? "page" : undefined}
              className={`${linkClassName} ${current ? "text-hot underline decoration-2 underline-offset-8" : ""}`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
