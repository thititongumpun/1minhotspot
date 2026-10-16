import type { Metadata } from "next";
import { SectionHead } from "@/components/section-head";

// Private, unlisted rate card at /ratecard-b8zsqov2. Nothing links here; the URL is handed out by email.
// No canonical, no sitemap entry, robots noindex — keep it that way.
export const metadata: Metadata = {
  title: "เรตการ์ดโฆษณา",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

const baseline = [
  ["ผู้เข้าชมทั้งโซน (รวมบอต)", "1.4–2.0k", "คน/วัน"],
  ["หน้า HTML จากเบราว์เซอร์จริง", "≈350", "วิว/วัน (≈10k/เดือน)"],
  ["ผู้ชมจากประเทศไทย", "≈57", "คน/วัน"],
  ["หน้าแรก (/)", "≈57", "วิว/วัน"],
  ["Facebook reach เฉลี่ย", "≈1,366", "คน/โพสต์"],
  ["Reel เฉลี่ย (มัธยฐาน)", "≈373", "เพลย์/คลิป จาก ~45 คลิป/วัน"],
] as const;

const packages = [
  ["Web Spotlight", "490", "แบนเนอร์หน้าแรก + การ์ดข้างบทความ + หน้าโปรโมชัน 14 วัน"],
  ["Post", "1,290", "Web Spotlight + โพสต์ภาพบน Facebook 1 โพสต์"],
  ["Reel", "2,990", "เว็บ 30 วัน + Reel (30–60 วินาที) ที่เราผลิตให้ 1 คลิป + โพสต์ 1 โพสต์"],
  ["Campaign", "6,900", "เว็บ 30 วัน + Reel 3 คลิป + โพสต์ 2 โพสต์ + รายงานผล"],
] as const;

const th = "py-3 pr-4 text-left text-sm font-medium text-muted";
const td = "border-t border-hairline py-3 pr-4 align-top";

export default function RateCardPage() {
  return (
    <article className="container-hot py-8 lg:py-12">
      <SectionHead as="h1" kicker="สำหรับผู้สนับสนุน" heading="เรตการ์ดโฆษณา" />

      <div className="rule mt-8 max-w-[68ch] space-y-10 pt-8">
        <p>
          ราคาในหน้านี้เป็นราคาร่าง (draft) จะปรับอีกครั้งหลังจบโปรเจกต์นำร่อง
          ตัวเลขทราฟฟิกด้านล่างมาจาก Cloudflare GraphQL ณ วันที่ 16 ตุลาคม 2569
        </p>

        <section>
          <h2 className="font-display text-xl font-bold text-fg">ทราฟฟิกพื้นฐาน</h2>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>ตัวชี้วัด</th>
                <th className={th}>ค่า</th>
                <th className={th}>หน่วย</th>
              </tr>
            </thead>
            <tbody>
              {baseline.map(([label, value, unit]) => (
                <tr key={label}>
                  <td className={td}>{label}</td>
                  <td className={`${td} timecode whitespace-nowrap`}>{value}</td>
                  <td className={`${td} text-muted`}>{unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-fg">แพ็กเกจและราคา</h2>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>แพ็กเกจ</th>
                <th className={th}>ราคา</th>
                <th className={th}>สิ่งที่ได้รับ</th>
              </tr>
            </thead>
            <tbody>
              {packages.map(([name, price, includes]) => (
                <tr key={name}>
                  <td className={`${td} font-display font-bold text-fg`}>{name}</td>
                  <td className={`${td} timecode whitespace-nowrap`}>฿{price}</td>
                  <td className={td}>{includes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3">
            เพิ่มเติม: ปักหมุดโพสต์ 7 วัน <span className="timecode">+฿500</span>
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-fg">ที่มาของราคา</h2>
          <ul className="mt-3 space-y-2">
            <li>
              เว็บ: ≈4.9k อิมเพรสชันใน 14 วัน × CPM ≈฿100 ≈{" "}
              <span className="timecode">฿490</span>
            </li>
            <li>
              Facebook: reach 1,366 คน เทียบเท่าโฆษณา Meta ≈{" "}
              <span className="timecode">฿140</span>{" "}
              ส่วนที่เหลือของราคาคือค่าผลิต การวางเนื้อหาแบบ native และความน่าเชื่อถือของช่อง
              reach เป็นค่าเฉลี่ย ไม่ใช่การรับประกัน
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-fg">โปรเจกต์นำร่อง: MEYER</h2>
          <p className="mt-3">
            MEYER Hello Kitty Collection เป็นโปรเจกต์นำร่องแบบไม่คิดค่าใช้จ่าย
            ลงเว็บถึง 6 พฤศจิกายน 2569 พร้อมโพสต์ 1 โพสต์ ยอดวิวและคลิกที่ได้จะใช้เป็นกรณีศึกษาสำหรับผู้สนับสนุนรายต่อไป
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-fg">ติดต่อ</h2>
          <p className="mt-3">
            สนใจลงโฆษณาหรือขอรายละเอียดเพิ่มเติม ส่งอีเมลมาที่{" "}
            <a href="mailto:ads@1minhotspot.com" className="link">
              ads@1minhotspot.com
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
