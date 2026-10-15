import type { MetadataRoute } from "next";

export const SITE = "https://chessassistlens.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: `${SITE}/sitemap.xml`, host: SITE };
}
