import { ImageResponse } from "next/og";
import { loadThaiFont, OG_COLORS } from "./og-shared";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "สรุปข่าวร้อนใน 1 นาที";

const TAGLINE = "ข่าวเร็ว จบในนาทีเดียว";

const fontBoldPromise = loadThaiFont("Anuphan", 700);
const fontMediumPromise = loadThaiFont("Anuphan", 600);

export default async function Image() {
  const [fontBold, fontMedium] = await Promise.all([fontBoldPromise, fontMediumPromise]);

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
          padding: "80px",
          fontFamily: "Anuphan",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "18px", height: "18px", backgroundColor: OG_COLORS.hot }} />
          <div
            style={{
              display: "flex",
              color: OG_COLORS.fg,
              fontSize: "34px",
              fontWeight: 700,
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
            fontSize: "72px",
            fontWeight: 700,
            lineHeight: 1.2,
            maxWidth: "980px",
          }}
        >
          {TAGLINE}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", height: "4px", width: "100%", backgroundColor: OG_COLORS.hairline }}>
            <div style={{ height: "100%", width: "62%", backgroundColor: OG_COLORS.hot }} />
          </div>
          <div
            style={{
              display: "flex",
              color: OG_COLORS.muted,
              fontSize: "26px",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            1minhotspot.site
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
