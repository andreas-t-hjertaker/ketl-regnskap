import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://ketlregnskap.web.app";

  return [
    { url: base, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/dashboard`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/dashboard/bilag`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/dashboard/klienter`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/dashboard/rapporter`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
  ];
}
