import type { MetadataRoute } from "next";

const SITE = "https://chessassistlens.vercel.app";
const PATHS = ["", "/chess", "/present", "/about", "/research", "/walkthrough", "/compare", "/examples", "/demo", "/results", "/methodology", "/analyze",
  "/latent", "/latent/professor", "/latent/proposal", "/latent/learn", "/latent/research", "/latent/recall", "/latent/methods", "/latent/demo", "/latent/project", "/latent/foundations", "/latent/build"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PATHS.map((p) => ({ url: `${SITE}${p}`, lastModified: now, changeFrequency: "weekly", priority: p === "" ? 1 : 0.8 }));
}
