import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Next Movie — Discover your next favorite film",
		short_name: "NextMovie",
		description:
			"Browse popular and upcoming movies and shows, build a watchlist, rate titles and get release notifications.",
		start_url: "/",
		display: "standalone",
		background_color: "#161216",
		theme_color: "#e11d48",
		icons: [
			{
				src: "/icon.svg",
				sizes: "any",
				type: "image/svg+xml",
				purpose: "any",
			},
		],
	};
}
