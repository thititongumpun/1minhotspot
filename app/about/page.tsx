import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, organizationJsonLd, pageOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "เกี่ยวกับเรา",
  description:
    "รู้จักสรุปข่าวร้อนใน 1 นาที นโยบายบรรณาธิการ การแก้ไขข้อผิดพลาด ที่มาของข่าว วิธีให้เครดิตแหล่งข่าว และช่องทางติดตามบน Facebook และ YouTube",
  alternates: { canonical: absoluteUrl("/about") },
  openGraph: pageOpenGraph(absoluteUrl("/about")),
};

export default function AboutPage() {
  return (
    <article className="container-hot py-8 lg:py-12">
      <JsonLd data={organizationJsonLd()} />
      <div className="max-w-[68ch]">
        <p className="kicker">เกี่ยวกับเรา</p>
        <h1 className="headline-wrap mt-3 font-display text-[clamp(1.75rem,4.5vw,3.5rem)] leading-[1.15] font-bold text-fg">
          เกี่ยวกับเรา
        </h1>

        <div className="rule mt-8 space-y-8 pt-8 text-[15px]">
          <section>
            <h2 className="font-display text-xl font-bold text-fg">สรุปข่าวร้อนใน 1 นาที</h2>
            <p className="mt-3">
              สรุปข่าวร้อนใน 1 นาที คือช่องข่าวคลิปสั้น ที่เขียนสรุปข่าวใหม่เป็นภาษาไทยพร้อมคลิปวิดีโอของเราเอง เพื่อให้ผู้อ่านตามทันข่าวได้ในเวลาอันสั้น
            </p>
            <p className="mt-3">
              เราอัปเดตคลิปข่าวใหม่ทุกชั่วโมง ครอบคลุม 5 หมวดหมู่หลัก ได้แก่ ข่าวสังคม บันเทิง การเมือง ไวรัล และเศรษฐกิจ
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-fg">บรรณาธิการและทีมงาน</h2>
            <p className="mt-3">
              บรรณาธิการผู้รับผิดชอบเนื้อหา: 1minhotspot
            </p>
            <p className="mt-3">
              ทีมงานของเราเขียนสรุปข่าวภาษาไทยทุกชิ้นด้วยตัวเอง ไม่นำบทความจากต้นทางมาเผยแพร่ซ้ำ
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-fg">นโยบายบรรณาธิการ</h2>
            <p className="mt-3">
              ทุกคลิปสรุปจากแหล่งข่าวที่ระบุชื่อชัดเจน เราแยกข้อเท็จจริงออกจากความคิดเห็นเสมอ ไม่ใช้ AI สร้างข้อมูลที่ไม่มีอยู่จริง
              และไม่นำบทความของสำนักข่าวต้นทางมาเผยแพร่ซ้ำทั้งชิ้น
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-fg">การแก้ไขข้อผิดพลาด</h2>
            <p className="mt-3">
              พบข้อผิดพลาดในเนื้อหาแจ้งเราได้ที่{" "}
              <a href="mailto:ads@1minhotspot.com" className="text-hot hover:underline">
                ads@1minhotspot.com
              </a>{" "}
              เมื่อตรวจสอบแล้วพบว่าผิดจริง เราจะแก้ไขภายใน 24 ชั่วโมง พร้อมอัปเดตวันที่แก้ไขและใส่หมายเหตุการแก้ไขไว้ในบทความนั้น
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-fg">แหล่งที่มาของข่าว</h2>
            <p className="mt-3">
              ทุกบทความให้เครดิตแหล่งที่มา และมีลิงก์ไปยังสำนักข่าวต้นฉบับเมื่อระบุได้ เนื้อหาที่นำเสนอเป็นการสรุปความ ไม่ใช่การนำบทความต้นฉบับมาเผยแพร่ซ้ำ
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-fg">ช่องทางของเรา</h2>
            <ul className="mt-3 space-y-2">
              <li>
                Facebook:{" "}
                <a
                  href="https://www.facebook.com/1minhotspot"
                  target="_blank"
                  rel="me noopener noreferrer"
                  className="text-hot hover:underline"
                >
                  facebook.com/1minhotspot
                </a>
              </li>
              <li>
                YouTube:{" "}
                <a
                  href="https://www.youtube.com/@1minhotspot"
                  target="_blank"
                  rel="me noopener noreferrer"
                  className="text-hot hover:underline"
                >
                  youtube.com/@1minhotspot
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-fg">ติดต่อเรา</h2>
            <p className="mt-3">
              มีข้อสงสัยหรือต้องการติดต่อเรื่องอื่น ส่งอีเมลมาได้ที่{" "}
              <a href="mailto:ads@1minhotspot.com" className="text-hot hover:underline">
                ads@1minhotspot.com
              </a>{" "}
              หรือดูช่องทางเพิ่มเติมได้ที่หน้า{" "}
              <Link href="/contact" className="text-hot hover:underline">
                ติดต่อเรา
              </Link>
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
