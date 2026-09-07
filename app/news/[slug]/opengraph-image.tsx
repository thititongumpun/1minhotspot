import { ImageResponse } from "next/og";
import { getClip } from "@/lib/clips";
import { formatTimecode } from "@/components/format";
import { loadThaiFont, OG_COLORS } from "../../og-shared";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "สรุปข่าวร้อนใน 1 นาที — คลิปข่าวสั้น";

const fontBoldPromise = loadThaiFont("Anuphan", 700);
const fontMediumPromise = loadThaiFont("Anuphan", 600);

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clip = await getClip(slug);
  const [fontBold, fontMedium] = await Promise.all([fontBoldPromise, fontMediumPromise]);

  const headline = clip ? clip.title : slug;
  const timecode = clip ? formatTimecode(clip.durationSec) : "0:00";
  const fill = clip ? `${Math.round(Math.min(Math.max(clip.durationSec, 0) / 60, 1) * 100)}%` : "0%";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: OG_COLORS.ink,
          padding: "72px",
          fontFamily: "Anuphan",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "16px", height: "16px", backgroundColor: OG_COLORS.hot }} />
          <div
            style={{
              display: "flex",
              color: OG_COLORS.muted,
              fontSize: "26px",
              fontWeight: 600,
              letterSpacing: "0.01em",
            }}
          >
            สรุปข่าวร้อนใน 1 นาที
          </div>
        </div>

        <div
          style={{
            display: "flex",
            color: OG_COLORS.fg,
            fontSize: "58px",
            fontWeight: 700,
            lineHeight: 1.28,
            maxWidth: "1040px",
          }}
        >
          {headline}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", height: "4px", width: "100%", backgroundColor: OG_COLORS.hairline }}>
            <div style={{ height: "100%", width: fill, backgroundColor: OG_COLORS.hot }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                color: OG_COLORS.muted,
                fontSize: "24px",
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              1minhotspot.com
            </div>
            <div
              style={{
                display: "flex",
                color: OG_COLORS.hot,
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              {timecode}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Anuphan", data: fontBold, weight: 700, style: "normal" },
        { name: "Anuphan", data: fontMedium, weight: 600, style: "normal" },
      ],
    },
  );
}
