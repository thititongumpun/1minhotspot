import Link from "next/link";
import { NAV } from "./nav";

// Plain text links, no icon library. Only the two channels we actually
// publish to — do not invent counts, badges, or extra platforms.
const SOCIALS = [
  { label: "Facebook", href: "https://www.facebook.com/1minhotspot" },
  { label: "YouTube", href: "https://www.youtube.com/@1minhotspot" },
];

const SITE_LINKS = [
  { label: "เกี่ยวกับเรา", href: "/about" },
  { label: "นโยบายความเป็นส่วนตัว", href: "/privacy" },
  { label: "ติดต่อเรา", href: "/contact" },
  { label: "RSS", href: "/feed.xml" },
];

export function SiteFooter() {
  // String, not number: Intl would group "2,026" and localise the digits.
  const year = String(new Date().getFullYear());

  return (
    <footer className="mt-16 border-t border-hairline lg:mt-24">
      <div className="container-hot grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:gap-8 lg:py-16">
        {/* Channel identity */}
        <div className="max-w-sm">
          <div className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="font-display text-[15px] leading-none font-semibold">
              สรุปข่าวร้อนใน
            </span>
            <span
              aria-hidden
              className="font-display text-2xl leading-none font-bold text-hot"
            >
              1
            </span>
            <span className="font-display text-[15px] leading-none font-semibold">
              นาที
            </span>
            <span aria-hidden className="font-mono text-[11px] leading-none text-muted">
              :60
            </span>
          </div>
          <p className="mt-4 text-sm text-muted">ช่องข่าวคลิปสั้น อัปเดตทุกวัน</p>
          <p className="mt-1 text-sm text-muted">ข่าวเร็ว จบในนาทีเดียว</p>
          <p className="timecode mt-5">กรุงเทพมหานคร ประเทศไทย</p>
        </div>

        {/* Menu duplication */}
        <nav aria-label="เมนู">
          <p className="kicker">เมนู</p>
          <ul className="mt-4 space-y-2">
            {NAV.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-block py-1 text-[15px] whitespace-nowrap text-muted transition-colors hover:text-hot"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Socials + ad sales */}
        <div>
          <p className="kicker">ติดตามเรา</p>
          <ul className="mt-4 space-y-2">
            {SOCIALS.map(({ label, href }) => (
              <li key={label}>
                <a
                  href={href}
                  rel="me noopener noreferrer"
                  target="_blank"
                  className="inline-block py-1 text-[15px] whitespace-nowrap text-muted transition-colors hover:text-hot"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>

          <p className="kicker mt-8">ติดต่อโฆษณา</p>
          <a
            href="mailto:ads@1minhotspot.com"
            className="mt-4 inline-block font-mono text-sm whitespace-nowrap text-fg transition-colors hover:text-hot"
          >
            ads@1minhotspot.com
          </a>

          <nav aria-label="ข้อมูลเว็บไซต์">
            <p className="kicker mt-8">ข้อมูลเว็บไซต์</p>
            <ul className="mt-4 space-y-2">
              {SITE_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="inline-block py-1 text-[15px] whitespace-nowrap text-muted transition-colors hover:text-hot"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className="border-t border-hairline">
        <p className="container-hot timecode py-5">© {year} สรุปข่าวร้อนใน 1 นาที สงวนลิขสิทธิ์</p>
      </div>
    </footer>
  );
}
