import { Anuphan, IBM_Plex_Sans_Thai } from "next/font/google";

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


export const fontVars = `${anuphan.variable} ${plexThai.variable}`;
