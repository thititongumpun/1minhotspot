import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        port: "",
        pathname: "/vi/**",
      },
      {
        protocol: "https",
        hostname: "static.bangkokpost.com",
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "p3.isanook.com",
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "s.isanook.com",
        port: "",
        pathname: "**",
      },
    ],
  },
};

export default nextConfig;
