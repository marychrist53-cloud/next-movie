import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/api/", "/admin", "/settings", "/notifications", "/watchlist", "/favorites", "/watched"],
			},
		],
		sitemap: `${siteUrl()}/sitemap.xml`,
	};
}
