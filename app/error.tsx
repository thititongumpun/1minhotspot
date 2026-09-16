"use client";

import Link from "next/link";

// Segment error boundary for every route under the root layout. Like
// app/not-found.tsx it renders *inside* app/layout.tsx, so no <html>/<body>.
// Without it a thrown server component shows Next's bare default screen —
// a dead end that looks nothing like the site.
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="container-hot py-16 lg:py-24">
      <div className="rule-left max-w-[68ch]">
        <p className="kicker">เกิดข้อผิดพลาด</p>
        <h1 className="headline-wrap mt-2 font-display text-3xl font-bold text-fg sm:text-4xl">
          หน้านี้โหลดไม่สำเร็จ
        </h1>
        <p className="mt-3 text-muted">ขออภัย ลองใหม่อีกครั้ง หรือกลับไปหน้าแรก</p>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          <button type="button" onClick={reset} className="link tap">
            ลองอีกครั้ง
          </button>
          <Link href="/" className="link tap">
            กลับหน้าแรก
          </Link>
        </p>
      </div>
    </section>
  );
}
