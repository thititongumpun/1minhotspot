import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "สรุปข่าวร้อนใน 1 นาที",
    short_name: "ข่าวร้อน 1 นาที",
    description: "ข่าวเร็ว จบในนาทีเดียว — bite-sized Thai news clips.",
    start_url: "/",
    // Hex, not oklch: manifest processors only parse legacy CSS colors.
    background_color: "#090c12",
    theme_color: "#090c12",
    display: "standalone",
    // public/, not the app/icon.png file convention: that route is served with
    // a build hash Next will not tell us, so a manifest entry pointing at it
    // would rot on the next deploy.
    icons: [{ src: "/logo.png", sizes: "512x512", type: "image/png" }],
  };
}
