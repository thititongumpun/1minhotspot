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
  title: "สรุปข่าวร้อนใน 1 นาที | 1minhotspot",
  description:
    "เสิร์ฟข่าวเด่น ข่าวกีฬา และเรื่องร้อนประจำวันในเวลาไม่เกิน 1 นาที! ติดตามทุกประเด็นสำคัญแบบไว รู้ทันโลก ไม่พลาดทุกกระแส เหมาะสำหรับคนไม่มีเวลา แต่อยากรู้ครบ จบไว อัปเดตใหม่ทุกวัน",
  keywords: [
    "ข่าว",
    "ข่าวด่วน",
    "ข่าวกีฬา",
    "ข่าวบันเทิง",
    "สรุปข่าว",
    "1 นาที",
    "ข่าวไทย",
    "ข่าวโลก",
    "Breaking News",
  ],
  authors: [{ name: "1minhotspot" }],
  creator: "1minhotspot",
  publisher: "1minhotspot",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://1minhotspot.vercel.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "สรุปข่าวร้อนใน 1 นาที | 1minhotspot",
    description:
      "เสิร์ฟข่าวเด่น ข่าวกีฬา และเรื่องร้อนประจำวันในเวลาไม่เกิน 1 นาที! ติดตามทุกประเด็นสำคัญแบบไว รู้ทันโลก ไม่พลาดทุกกระแส",
    url: "https://1minhotspot.vercel.app",
    siteName: "1minhotspot",
    locale: "th_TH",
    type: "website",
    images: [
      {
        url: "/logobro.png",
        width: 1200,
        height: 630,
        alt: "1minhotspot - สรุปข่าวร้อนใน 1 นาที",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "สรุปข่าวร้อนใน 1 นาที | 1minhotspot",
    description:
      "เสิร์ฟข่าวเด่น ข่าวกีฬา และเรื่องร้อนประจำวันในเวลาไม่เกิน 1 นาที!",
    images: ["/logobro.png"],
  },
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
  verification: {
    google: "your-google-verification-code", // Add your Google Search Console verification code
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
