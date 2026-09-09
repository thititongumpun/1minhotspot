/** Primary menu: home + the five categories + all videos. Shared by header, mobile nav, and footer. */
export const NAV = [
  { href: "/", label: "หน้าแรก" },
  { href: "/category/society", label: "ข่าวสังคม" },
  { href: "/category/entertainment", label: "บันเทิง" },
  { href: "/category/politics", label: "การเมือง" },
  { href: "/category/viral", label: "ไวรัล" },
  { href: "/category/economy", label: "เศรษฐกิจ" },
  { href: "/videos", label: "คลิปทั้งหมด" },
] as const;
