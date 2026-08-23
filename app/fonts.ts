import { Anuphan, IBM_Plex_Mono, IBM_Plex_Sans_Thai } from "next/font/google";

// Display / headlines.
const anuphan = Anuphan({
  subsets: ["latin", "thai"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-anuphan",
});

// Body / UI.
const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["latin", "thai"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-thai",
});

// Timecodes, kickers, dates. IBM Plex Mono ships no Thai subset, so `thai` is
// omitted here; --font-mono stacks --font-plex-thai behind it in globals.css.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const fontVars = `${anuphan.variable} ${plexThai.variable} ${plexMono.variable}`;
