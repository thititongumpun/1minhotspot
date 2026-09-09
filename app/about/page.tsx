import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "เกี่ยวกับเรา",
  description:
    "รู้จักสรุปข่าวร้อนใน 1 นาที ช่องข่าวคลิปสั้นภาษาไทย ที่มาของข่าว วิธีให้เครดิตแหล่งข่าว และช่องทางติดตามบน Facebook และ YouTube",
  alternates: { canonical: absoluteUrl("/about") },
};

export default function AboutPage() {
  return (
    <article className="container-hot py-8 lg:py-12">
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
        </div>
      </div>
    </article>
  );
}
