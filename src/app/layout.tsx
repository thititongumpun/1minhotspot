import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "สรุปข่าวร้อนใน 1 นาที | ข่าวสั้น กระชับ เข้าใจง่าย",
  description:
    "อัปเดตข่าวร้อนล่าสุดภายใน 1 นาที ครบทุกประเด็นสำคัญ ข่าวสั้น กระชับ เข้าใจง่าย เหมาะสำหรับคนที่มีเวลาน้อย",
  keywords: [
    "ข่าวร้อน",
    "ข่าวสั้น",
    "สรุปข่าว",
    "ข่าววันนี้",
    "ข่าวด่วน",
    "ข่าวล่าสุด",
  ],
  authors: [{ name: "ทีมงานสรุปข่าว" }],
  openGraph: {
    title: "สรุปข่าวร้อนใน 1 นาที",
    description:
      "ติดตามสรุปข่าวร้อนแบบสั้น กระชับ เข้าใจง่าย อัปเดตทุกวันใน 1 นาที",
    url: "https://1minhotspot.vercel.app", // เปลี่ยนเป็น domain ของคุณ
    siteName: "สรุปข่าวร้อน",
    images: [
      {
        url: "https://example.com/og-image.jpg", // รูปภาพแชร์บน Facebook/Line
        width: 1200,
        height: 630,
        alt: "สรุปข่าวร้อนใน 1 นาที",
      },
    ],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "สรุปข่าวร้อนใน 1 นาที",
    description:
      "ข่าวสั้น กระชับ เข้าใจง่าย อัปเดตทุกวัน เหมาะสำหรับคนที่มีเวลาน้อย",
    images: ["https://example.com/og-image.jpg"], // ใช้รูปเดียวกับ OpenGraph
    creator: "@TTongumpun",
  },
  metadataBase: new URL("https://1minhotspot.vercel.app"), // ใส่ domain ของคุณ
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
