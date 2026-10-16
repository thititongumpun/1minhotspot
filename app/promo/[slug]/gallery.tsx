"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { promoSmallUrl, type PromoImage } from "@/lib/types";
import s from "./page.module.css";

/**
 * The gallery grid plus an on-site viewer on a native <dialog> (Esc, focus and
 * the backdrop come from the browser). Each tile is still a plain link to the
 * full file, so without JS a click opens the picture directly.
 */
export function Gallery({ images }: { images: PromoImage[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(0);
  const img = images[i];
  const step = (d: number) => setI((n) => (n + d + images.length) % images.length);
  const touchX = useRef(0);

  return (
    <>
      <ul className={`${s.strip} m-0 mt-2 list-none p-0`}>
        {images.map((im, n) => (
          <li key={im.url} className={s.rise}>
            <a
              href={im.url}
              aria-label={`${im.alt} (ดูภาพขนาดเต็ม)`}
              onClick={(e) => {
                e.preventDefault();
                setI(n);
                dialog.current?.showModal();
              }}
            >
              <Image
                src={promoSmallUrl(im.url)}
                alt={im.alt}
                width={640}
                height={Math.round((640 * im.h) / im.w)}
                loading="lazy"
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              />
            </a>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        className={s.viewer}
        aria-label={img?.alt}
        // The dialog fills the screen, so "backdrop" = anywhere but the picture and the controls.
        onClick={(e) => !(e.target as Element).closest("img, figcaption") && dialog.current?.close()}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
        }}
      >
        {img && (
          <figure className="m-0">
            <div className={s.viewerFrame}>
              {/* eslint-disable-next-line @next/next/no-img-element -- full file, already sized */}
              <img src={img.url} alt={img.alt} width={img.w} height={img.h} className={s.viewerImg} />
            </div>
            <figcaption className="flex w-full items-center justify-center gap-4 text-base text-white">
              <button type="button" className={s.viewerBtn} onClick={() => step(-1)} aria-label="ภาพก่อนหน้า">
                ‹
              </button>
              <span className="tabular-nums text-white">
                {i + 1} / {images.length}
              </span>
              <button type="button" className={s.viewerBtn} onClick={() => step(1)} aria-label="ภาพถัดไป">
                ›
              </button>
              <button type="button" className={s.viewerBtn} onClick={() => dialog.current?.close()} aria-label="ปิด">
                ✕
              </button>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}
