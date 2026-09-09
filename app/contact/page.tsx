import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "ติดต่อเรา",
  description:
    "ติดต่อสรุปข่าวร้อนใน 1 นาที สำหรับลงโฆษณา แจ้งแก้ไขข้อมูล หรือเรื่องลิขสิทธิ์ ทางอีเมล ads@1minhotspot.com และเพจ Facebook",
  alternates: { canonical: absoluteUrl("/contact") },
};

export default function ContactPage() {
  return (
    <article className="container-hot py-8 lg:py-12">
      <div className="max-w-[68ch]">
        <p className="kicker">ติดต่อเรา</p>
        <h1 className="headline-wrap mt-3 font-display text-[clamp(1.75rem,4.5vw,3.5rem)] leading-[1.15] font-bold text-fg">
          ติดต่อเรา
        </h1>

        <div className="rule mt-8 space-y-8 pt-8 text-[15px]">
          <section>
            <h2 className="font-display text-xl font-bold text-fg">อีเมล</h2>
            <p className="mt-3">
              ติดต่อโฆษณา แจ้งแก้ไขข้อมูล หรือเรื่องลิขสิทธิ์และการขอให้นำเนื้อหาออก ส่งมาได้ที่{" "}
              <a href="mailto:ads@1minhotspot.com" className="text-hot hover:underline">
                ads@1minhotspot.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-fg">Facebook</h2>
            <p className="mt-3">
              ติดตามและส่งข้อความหาเราได้ที่{" "}
              <a
                href="https://www.facebook.com/1minhotspot"
                target="_blank"
                rel="me noopener noreferrer"
                className="text-hot hover:underline"
              >
                facebook.com/1minhotspot
              </a>
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
