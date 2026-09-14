import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAnimeCatalog, fetchAnimeList, fetchDiscover, fetchMediaList } from "@/lib/tmdb";

function jsonList(results: Record<string, unknown>[]) {
	return Response.json({
		page: 1,
		total_pages: 1,
		total_results: results.length,
		results,
	});
}

function calledUrl(fetchMock: ReturnType<typeof vi.fn>, index: number): string {
	const call = fetchMock.mock.calls[index];
	if (!call) throw new Error(`Missing fetch call ${index}`);
	return String(call[0]);
}

describe("fetchMediaList dated catalogs", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fetches movies and series sorted by popularity", async () => {
		const fetchMock = vi.fn(async () =>
			jsonList([
				{ id: 2, title: "Low", name: "Low", popularity: 1, vote_average: 1 },
				{ id: 1, title: "High", name: "High", popularity: 99, vote_average: 8 },
			]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const movies = await fetchMediaList("movie", "release-today", 1);
		const shows = await fetchMediaList("tv", "release-today", 1);

		expect(movies.results.map(item => item.id)).toEqual([1, 2]);
		expect(shows.results.map(item => item.id)).toEqual([1, 2]);

		const movieUrl = calledUrl(fetchMock, 0);
		const tvUrl = calledUrl(fetchMock, 1);
		expect(movieUrl).toContain("/discover/movie");
		expect(movieUrl).toContain("sort_by=popularity.desc");
		expect(tvUrl).toContain("/discover/tv");
		expect(tvUrl).toContain("sort_by=popularity.desc");
		expect(tvUrl).toContain("air_date");
	});

	it("requests theatrical and digital movie release types for today", async () => {
		const fetchMock = vi.fn(async () =>
			jsonList([
				{ id: 1, title: "High", popularity: 20, vote_average: 7 },
			]),
		);
		vi.stubGlobal("fetch", fetchMock);

		await fetchMediaList("movie", "theatrical-today", 1);
		await fetchMediaList("movie", "digital-today", 1);

		const theatricalUrl = calledUrl(fetchMock, 0);
		const digitalUrl = calledUrl(fetchMock, 1);
		expect(theatricalUrl).toContain("/discover/movie");
		expect(theatricalUrl).toContain("with_release_type=2");
		expect(theatricalUrl).toContain("release_date");
		expect(digitalUrl).toContain("with_release_type=4");
		expect(digitalUrl).toContain("release_date");
	});

	it("requests TV theatrical air dates and digital first-air dates", async () => {
		const fetchMock = vi.fn(async () =>
			jsonList([{ id: 9, name: "Show", popularity: 12, vote_average: 8 }]),
		);
		vi.stubGlobal("fetch", fetchMock);

		await fetchMediaList("tv", "theatrical-today", 1);
		await fetchMediaList("tv", "digital-today", 1);

		const theatricalUrl = calledUrl(fetchMock, 0);
		const digitalUrl = calledUrl(fetchMock, 1);
		expect(theatricalUrl).toContain("/discover/tv");
		expect(theatricalUrl).toContain("air_date");
		expect(digitalUrl).toContain("first_air_date");
	});
});

describe("fetchAnimeCatalog", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("discovers Japanese and Chinese animation for movies and series", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/discover/movie")) {
				return jsonList([
					{ id: 2, title: "Low", popularity: 2, vote_average: 6 },
					{ id: 1, title: "High", popularity: 40, vote_average: 8 },
				]);
			}
			return jsonList([
				{ id: 4, name: "Low Show", popularity: 3, vote_average: 6 },
				{ id: 3, name: "High Show", popularity: 50, vote_average: 9 },
			]);
		});
		vi.stubGlobal("fetch", fetchMock);

		const japanese = await fetchAnimeCatalog("japanese", "release-today", 1);
		const chinese = await fetchAnimeCatalog("chinese", "release-today", 1);

		expect(japanese.results.map(item => item.id)).toEqual([3, 1, 4, 2]);
		expect(chinese.results).toHaveLength(4);

		const japaneseMovieUrl = calledUrl(fetchMock, 0);
		const japaneseTvUrl = calledUrl(fetchMock, 1);
		const chineseMovieUrl = calledUrl(fetchMock, 2);

		expect(japaneseMovieUrl).toContain("/discover/movie");
		expect(japaneseMovieUrl).toContain("with_genres=16");
		expect(japaneseMovieUrl).toContain("with_original_language=ja");
		expect(japaneseMovieUrl).toContain("with_origin_country=JP");
		expect(japaneseMovieUrl).toContain("primary_release_date");
		expect(japaneseTvUrl).toContain("/discover/tv");
		expect(japaneseTvUrl).toContain("air_date");
		expect(chineseMovieUrl).toContain("with_original_language=zh");
		expect(chineseMovieUrl).toContain("CN");
	});

	it("requests top-rated, upcoming, and trending anime filters", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/trending/")) {
				return jsonList([
					{
						id: 11,
						title: "Anime Hit",
						original_language: "ja",
						genre_ids: [16],
						origin_country: ["JP"],
						popularity: 80,
					},
					{
						id: 12,
						title: "Live Action",
						original_language: "ja",
						genre_ids: [28],
						origin_country: ["JP"],
						popularity: 90,
					},
				]);
			}
			return jsonList([
				{ id: 1, title: "Show", name: "Show", popularity: 10, vote_average: 8 },
			]);
		});
		vi.stubGlobal("fetch", fetchMock);

		await fetchAnimeCatalog("japanese", "top-rated", 1);
		const topRatedUrl = calledUrl(fetchMock, 0);
		expect(topRatedUrl).toContain("sort_by=vote_average.desc");
		expect(topRatedUrl).toContain("vote_count.gte=50");

		fetchMock.mockClear();
		await fetchAnimeCatalog("japanese", "upcoming", 1);
		expect(calledUrl(fetchMock, 0)).toContain("/discover/movie");
		expect(calledUrl(fetchMock, 0)).toContain("primary_release_date.gte");
		expect(calledUrl(fetchMock, 1)).toContain("/discover/tv");
		expect(calledUrl(fetchMock, 1)).toContain("first_air_date.gte");

		fetchMock.mockClear();
		const trending = await fetchAnimeCatalog("japanese", "trending", 1);
		expect(calledUrl(fetchMock, 0)).toContain("/trending/movie/week");
		expect(calledUrl(fetchMock, 5)).toContain("/trending/tv/week");
		expect(trending.results.map(item => item.id)).toEqual([11, 11]);
	});

	it("fetches a single anime media list like movies or series", async () => {
		const fetchMock = vi.fn(async () =>
			jsonList([{ id: 21, title: "Solo", popularity: 12, vote_average: 8 }]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const movies = await fetchAnimeList("japanese", "movie", "release-today", 1);
		const shows = await fetchAnimeList("chinese", "tv", "release-today", 1);

		expect(movies.results.map(item => item.id)).toEqual([21]);
		expect(calledUrl(fetchMock, 0)).toContain("/discover/movie");
		expect(calledUrl(fetchMock, 0)).toContain("with_original_language=ja");
		expect(calledUrl(fetchMock, 1)).toContain("/discover/tv");
		expect(calledUrl(fetchMock, 1)).toContain("with_original_language=zh");
		expect(calledUrl(fetchMock, 1)).toContain("air_date");
		expect(shows.results).toHaveLength(1);
	});
});

describe("fetchMediaList trending", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("uses weekly trending endpoints for movies and series", async () => {
		const fetchMock = vi.fn(async () =>
			jsonList([{ id: 5, title: "Hit", name: "Hit", popularity: 10 }]),
		);
		vi.stubGlobal("fetch", fetchMock);

		await fetchMediaList("movie", "trending", 1);
		await fetchMediaList("tv", "trending", 1);

		expect(calledUrl(fetchMock, 0)).toContain("/trending/movie/week");
		expect(calledUrl(fetchMock, 1)).toContain("/trending/tv/week");
	});
});

describe("fetchDiscover watch providers", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("adds TMDB watch-provider and region filters", async () => {
		const fetchMock = vi.fn(async () =>
			jsonList([{ id: 1, title: "On Netflix", popularity: 20, vote_average: 8 }]),
		);
		vi.stubGlobal("fetch", fetchMock);

		await fetchDiscover({
			watchProviders: ["8", "999"],
			watchRegion: "GB",
		});

		const url = calledUrl(fetchMock, 0);
		expect(url).toContain("/discover/movie");
		expect(url).toContain("with_watch_providers=8");
		expect(url).toContain("watch_region=GB");
		expect(url).not.toContain("999");
	});
});
