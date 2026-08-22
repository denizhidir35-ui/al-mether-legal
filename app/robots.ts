import type { MetadataRoute } from "next";

const SITE_URL = "https://legal.almether.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy"],
      disallow: [
        "/api/", "/auth/", "/calendar", "/cases", "/celse-import",
        "/converter", "/dashboard", "/dashboard-v2", "/download",
        "/file-viewer", "/inbox", "/login", "/mail-connect", "/search",
        "/settings", "/uets-import",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
