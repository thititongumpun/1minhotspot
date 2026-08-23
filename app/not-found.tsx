import Link from "next/link";

// The root not-found also serves every unmatched URL. It renders *inside*
// app/layout.tsx, so it must not emit its own <html>/<body>.
export default function NotFound() {
  return (
    <section className="container-hot py-16 lg:py-24">
      <div className="rule-left max-w-[68ch]">
        <p className="kicker">404</p>
        <h1 className="headline-wrap mt-2 font-display text-3xl font-bold text-fg sm:text-4xl">
          ไม่พบหน้านี้
        </h1>
        <p className="mt-3 text-muted">ขออภัย เราไม่พบหน้าที่คุณต้องการ</p>
        <p className="mt-6">
          <Link href="/" className="text-hot hover:underline">
            กลับหน้าแรก
          </Link>
        </p>
      </div>
    </section>
  );
}
