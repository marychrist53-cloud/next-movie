import type { MetadataRoute } from "next";

import {
	ANIME_LIST_CATEGORIES,
	ANIME_ORIGINS,
	fetchByGenre,
	fetchGenres,
	MOVIE_CATEGORIES,
	TV_CATEGORIES,
} from "@/lib/tmdb";
import { siteUrl } from "@/lib/site";

const BASE = siteUrl();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const staticRoutes = [
		"",
		"/discover",
		"/login",
		"/register",
		"/privacy",
		"/terms",
		...MOVIE_CATEGORIES.map(c => `/browse/movies/${c}`),
		...TV_CATEGORIES.map(c => `/browse/tv/${c}`),
		...ANIME_ORIGINS.flatMap(origin =>
			ANIME_LIST_CATEGORIES.map(c => `/browse/anime/${origin}/${c}`),
		),
	].map(path => ({
		url: `${BASE}${path}`,
		lastModified: new Date(),
		changeFrequency: "daily" as const,
		priority: path === "" ? 1 : 0.7,
	}));

	let genreRoutes: MetadataRoute.Sitemap = [];
	try {
		const genres = await fetchGenres();
		genreRoutes = genres.map(genre => ({
			url: `${BASE}/genre/${encodeURIComponent(genre.name)}/${genre.id}`,
			lastModified: new Date(),
			changeFrequency: "daily" as const,
			priority: 0.6,
		}));
	} catch (error) {
		console.error("[sitemap] failed to load genres", error);
	}

	let movieRoutes: MetadataRoute.Sitemap = [];
	try {
		const popular = await fetchByGenre("28");
		movieRoutes = popular.results.slice(0, 30).map(movie => ({
			url: `${BASE}/detail/${movie.id}`,
			lastModified: new Date(),
			changeFrequency: "weekly" as const,
			priority: 0.5,
		}));
	} catch (error) {
		console.error("[sitemap] failed to load movie routes", error);
	}

	return [...staticRoutes, ...genreRoutes, ...movieRoutes];
}
