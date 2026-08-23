import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "สรุปข่าวร้อนใน 1 นาที",
    short_name: "ข่าวร้อน 1 นาที",
    description: "ข่าวเร็ว จบในนาทีเดียว — bite-sized Thai news clips.",
    start_url: "/",
    background_color: "oklch(0.155 0.014 264)",
    theme_color: "oklch(0.155 0.014 264)",
    display: "standalone",
    // public/, not the app/icon.png file convention: that route is served with
    // a build hash Next will not tell us, so a manifest entry pointing at it
    // would rot on the next deploy.
    icons: [{ src: "/logo.png", sizes: "512x512", type: "image/png" }],
  };
}
