import type { Metadata } from "next";
import { absoluteUrl, pageOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว",
  description:
    "นโยบายความเป็นส่วนตัวของสรุปข่าวร้อนใน 1 นาที ข้อมูลที่เก็บ คุกกี้ โฆษณา Google AdSense การวิเคราะห์การใช้งาน และสิทธิ์ตาม PDPA",
  alternates: { canonical: absoluteUrl("/privacy") },
  openGraph: pageOpenGraph(absoluteUrl("/privacy")),
};

export default function PrivacyPage() {
  return (
    <article className="container-hot py-8 lg:py-12">
      <div className="max-w-[68ch]">
        <p className="kicker">นโยบาย</p>
        <h1 className="headline-wrap mt-3 font-display text-[clamp(1.75rem,4.5vw,3.5rem)] leading-[1.15] font-bold text-fg">
          นโยบายความเป็นส่วนตัว
        </h1>

        <div className="rule mt-8 space-y-8 pt-8">
          <section>
            <h2 className="font-display text-xl font-bold text-fg">ข้อมูลที่เราเก็บ</h2>
            <p className="mt-3">
              เว็บไซต์นี้ไม่มีระบบสมาชิกและไม่เก็บชื่อหรืออีเมลของผู้เข้าชม นอกจากข้อมูลที่ผู้ใช้ส่งมาเองทางอีเมล เช่น
              เมื่อติดต่อสอบถามหรือแจ้งเรื่องต่าง ๆ
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-fg">คุกกี้</h2>
            <p className="mt-3">
              เว็บไซต์อาจใช้คุกกี้ในการแสดงผลหน้าเว็บและโฆษณาให้ทำงานได้ปกติ ผู้ให้บริการโฆษณาบุคคลที่สามอาจตั้งค่าคุกกี้ของตนเองตามที่ระบุในหัวข้อโฆษณาด้านล่าง
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-fg">โฆษณา</h2>
            <p className="mt-3">
              เว็บไซต์นี้แสดงโฆษณาผ่าน Google AdSense และผู้ให้บริการโฆษณาบุคคลที่สามอื่น ๆ ผู้ให้บริการเหล่านี้อาจใช้คุกกี้เพื่อแสดงโฆษณาตามความสนใจของผู้ใช้ ดูรายละเอียดได้ที่{" "}
              <a
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noopener"
                className="text-hot hover:underline"
              >
                policies.google.com/technologies/ads
              </a>{" "}
              และสามารถปิดการแสดงโฆษณาตามความสนใจได้ที่{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener"
                className="text-hot hover:underline"
              >
                google.com/settings/ads
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-fg">การวิเคราะห์การใช้งาน</h2>
            <p className="mt-3">
              เว็บไซต์ใช้ Cloudflare Web Analytics เพื่อเก็บสถิติการเข้าชมและความเร็วในการโหลดหน้าเว็บ
              โดยข้อมูลที่เก็บเป็นสถิติรวมแบบไม่ระบุตัวตนและไม่ใช้คุกกี้ในการติดตาม
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-fg">การเก็บรักษาข้อมูล</h2>
            <p className="mt-3">
              เราเก็บเฉพาะข้อมูลที่จำเป็นต่อการให้บริการเว็บไซต์ และเก็บไว้เท่าที่จำเป็นต่อวัตถุประสงค์ที่ระบุไว้ข้างต้นเท่านั้น
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-fg">
              สิทธิ์ของผู้ใช้ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)
            </h2>
            <p className="mt-3">
              ผู้ใช้มีสิทธิ์ขอเข้าถึง แก้ไข หรือขอให้ลบข้อมูลส่วนบุคคลที่ส่งมาให้เราทางอีเมล หากมีข้อสงสัยหรือต้องการใช้สิทธิ์ดังกล่าว
              ติดต่อเราได้ที่{" "}
              <a href="mailto:ads@1minhotspot.com" className="text-hot hover:underline">
                ads@1minhotspot.com
              </a>
            </p>
          </section>

          <p className="timecode">
            ปรับปรุงล่าสุด <time dateTime="2026-09-13">13 กันยายน 2569</time>
          </p>
        </div>
      </div>
    </article>
  );
}
