/**
 * Shown while an article renders on demand — any slug past PRERENDER_LIMIT, or
 * a prerendered one whose cache entry has expired. Those paths hit the store
 * and may resolve the source article, so the wait is real, not a paint frame.
 *
 * The shape mirrors page.tsx exactly (same container, same grid, same rail) so
 * the swap to real content doesn't move anything.
 */
const BODY_LINES = ["w-full", "w-full", "w-11/12", "w-4/5"];

export default function Loading() {
  return (
    <article className="container-hot py-8 lg:py-12" aria-busy="true">
      <span className="sr-only">กำลังโหลดข่าว</span>

      {/* Breadcrumb */}
      <div aria-hidden className="flex items-center gap-2">
        <span className="skeleton block h-3 w-14" />
        <span className="skeleton block h-3 w-16" />
      </div>

      <header aria-hidden className="mt-6 max-w-[68ch]">
        <span className="skeleton block h-3 w-20" />
        {/* Two headline bars: the real h1 is clamped 1.75rem–3.5rem, so the
            bar heights track the same clamp rather than a fixed guess. */}
        <div className="mt-3 space-y-3">
          <span className="skeleton block h-[clamp(1.75rem,4.5vw,3.5rem)] w-full" />
          <span className="skeleton block h-[clamp(1.75rem,4.5vw,3.5rem)] w-3/4" />
        </div>
        <span className="skeleton mt-4 block h-3 w-56 max-w-full" />
        {/* The real rail with no fill — a hairline, not a fake value. */}
        <span aria-hidden className="hot-rail mt-3" />
      </header>

      <div
        aria-hidden
        className="mt-8 grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start"
      >
        <div className="max-w-[68ch] space-y-3 lg:col-start-1 lg:row-start-1">
          <span className="skeleton block h-5 w-full" />
          <span className="skeleton block h-5 w-5/6" />
        </div>

        <aside className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
          {/* 9:16 — the clip's platform is unknown until the data lands, and
              the store is overwhelmingly Facebook reels. A YouTube clip
              settles from portrait to 16:9 once ClipEmbed takes over. */}
          <span className="skeleton block aspect-[9/16] w-full" />
          <span className="skeleton mt-3 block h-3 w-28" />
          <span className="skeleton mt-3 block h-4 w-40" />
        </aside>

        <div className="max-w-[68ch] space-y-3 lg:col-start-1 lg:row-start-2">
          {BODY_LINES.map((w, i) => (
            <span key={i} className={`skeleton block h-5 ${w}`} />
          ))}
        </div>
      </div>
    </article>
  );
}
