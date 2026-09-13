import type {
	CastMemberType,
	CreditType,
	GenreType,
	MediaType,
	MovieType,
	PaginatedResult,
	PersonCreditsType,
	PersonDetailType,
	ProviderType,
	ReviewType,
	TvDetailType,
	VideoType,
	WatchProvidersType,
} from "@/types/global";

const BASE_URL = "https://api.themoviedb.org/3";

type TmdbInit = RequestInit & {
	next?: { revalidate?: number; tags?: string[] };
};

export async function tmdb<T>(path: string, init?: TmdbInit): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
			...init?.headers,
		},
	});

	if (!res.ok) {
		throw new Error(`TMDB request failed (${res.status}): ${path}`);
	}

	return res.json();
}

export function imageUrl(
	path: string | null | undefined,
	size:
		| "w92"
		| "w185"
		| "w300"
		| "w342"
		| "w500"
		| "w780"
		| "w1280"
		| "original" = "w500",
): string | null {
	if (!path) return null;
	return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function youtubeThumb(key: string): string {
	return `https://img.youtube.com/vi/${key}/mqdefault.jpg`;
}

export function year(date: string | null | undefined): string {
	const y = (date ?? "").split("-")[0];
	return /^\d{4}$/.test(y) ? y : "—";
}

const REVALIDATE_HOUR = { next: { revalidate: 3600 } };
const MAX_PAGE = 500;

/* ---------------------------------- lists --------------------------------- */

function toCardItem(
	item: Record<string, unknown>,
	mediaType: MediaType,
): MovieType {
	return {
		id: item.id as number,
		media_type: mediaType,
		title: String(
			item.title ?? item.name ?? item.original_name ?? "Untitled",
		),
		overview: String(item.overview ?? ""),
		poster_path: (item.poster_path as string | null) ?? null,
		backdrop_path: (item.backdrop_path as string | null) ?? null,
		release_date: (item.release_date ??
			item.first_air_date ??
			null) as string | null,
		vote_average: Number(item.vote_average ?? 0),
		vote_count: Number(item.vote_count ?? 0),
		popularity: Number(item.popularity ?? 0),
		genre_ids: (item.genre_ids as number[] | undefined) ?? [],
	};
}

async function paginated<T>(
	path: string,
	params: Record<string, string> = {},
): Promise<PaginatedResult<T>> {
	const search = new URLSearchParams(params);
	const data = await tmdb<PaginatedResult<T>>(
		`${path}${search.size ? `?${search}` : ""}`,
		REVALIDATE_HOUR,
	);
	return {
		results: data.results ?? [],
		page: data.page ?? 1,
		total_pages: Math.min(data.total_pages ?? 1, MAX_PAGE),
		total_results: data.total_results ?? 0,
	};
}

export type MediaCategory =
	| "popular"
	| "top-rated"
	| "trending"
	| "now-playing"
	| "upcoming"
	| "on-the-air"
	| "release-today"
	| "theatrical-today"
	| "digital-today";

export type AnimeOrigin = "japanese" | "chinese";
export type AnimeCategory = AnimeOrigin;
export type AnimeListCategory =
	| "release-today"
	| "top-rated"
	| "trending"
	| "upcoming";

const ANIMATION_GENRE = 16;

const MOVIE_LIST_PATHS: Record<MediaCategory, string> = {
	popular: "/movie/popular",
	"top-rated": "/movie/top_rated",
	trending: "/trending/movie/week",
	"now-playing": "/movie/now_playing",
	upcoming: "/movie/upcoming",
	"on-the-air": "/movie/now_playing",
	"release-today": "/discover/movie",
	"theatrical-today": "/discover/movie",
	"digital-today": "/discover/movie",
};

const TV_LIST_PATHS: Record<MediaCategory, string> = {
	popular: "/tv/popular",
	"top-rated": "/tv/top_rated",
	trending: "/trending/tv/week",
	"now-playing": "/tv/airing_today",
	upcoming: "/tv/on_the_air",
	"on-the-air": "/tv/on_the_air",
	"release-today": "/discover/tv",
	"theatrical-today": "/discover/tv",
	"digital-today": "/discover/tv",
};

export const MOVIE_CATEGORIES: MediaCategory[] = [
	"trending",
	"popular",
	"top-rated",
	"now-playing",
	"upcoming",
	"release-today",
	"theatrical-today",
	"digital-today",
];

export const TV_CATEGORIES: MediaCategory[] = [
	"trending",
	"popular",
	"top-rated",
	"on-the-air",
	"release-today",
	"theatrical-today",
	"digital-today",
];

export const ANIME_ORIGINS: AnimeOrigin[] = ["japanese", "chinese"];
export const ANIME_CATEGORIES = ANIME_ORIGINS;

export const ANIME_LIST_CATEGORIES: AnimeListCategory[] = [
	"release-today",
	"top-rated",
	"trending",
	"upcoming",
];

const ANIME_FILTERS: Record<
	AnimeOrigin,
	{ language: string; origin: string }
> = {
	japanese: { language: "ja", origin: "JP" },
	chinese: { language: "zh", origin: "CN|TW|HK" },
};

function todayIsoDate(): string {
	return new Date().toISOString().slice(0, 10);
}

function isoDateOffset(days: number): string {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function popularityDiscoverParams(): Record<string, string> {
	return {
		sort_by: "popularity.desc",
		include_adult: "false",
	};
}

export function isDatedBrowseCategory(category: string): boolean {
	return (
		category === "release-today" ||
		category === "theatrical-today" ||
		category === "digital-today"
	);
}

function datedListParams(
	media: MediaType,
	category: MediaCategory,
): Record<string, string> {
	if (!isDatedBrowseCategory(category)) return {};

	const today = todayIsoDate();
	const sort = popularityDiscoverParams();

	if (category === "theatrical-today") {
		return media === "tv"
			? {
					...sort,
					"air_date.gte": today,
					"air_date.lte": today,
				}
			: {
					...sort,
					with_release_type: "2|3",
					"release_date.gte": today,
					"release_date.lte": today,
				};
	}

	if (category === "digital-today") {
		return media === "tv"
			? {
					...sort,
					"first_air_date.gte": today,
					"first_air_date.lte": today,
				}
			: {
					...sort,
					with_release_type: "4",
					"release_date.gte": today,
					"release_date.lte": today,
				};
	}

	return media === "tv"
		? {
				...sort,
				"air_date.gte": today,
				"air_date.lte": today,
			}
		: {
				...sort,
				"primary_release_date.gte": today,
				"primary_release_date.lte": today,
			};
}

function sortByPopularity(items: MovieType[]): MovieType[] {
	return [...items].sort(
		(a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
	);
}

export async function fetchMediaList(
	media: MediaType,
	category: MediaCategory,
	page = 1,
): Promise<PaginatedResult<MovieType>> {
	const path =
		media === "tv"
			? TV_LIST_PATHS[category]
			: MOVIE_LIST_PATHS[category];
	const res = await paginated<Record<string, unknown>>(path, {
		page: String(page),
		...datedListParams(media, category),
	});
	const results = res.results.map(item => toCardItem(item, media));
	return {
		...res,
		results: isDatedBrowseCategory(category)
			? sortByPopularity(results)
			: results,
	};
}

function animeOriginParams(origin: AnimeOrigin): Record<string, string> {
	const filter = ANIME_FILTERS[origin];
	return {
		include_adult: "false",
		with_genres: String(ANIMATION_GENRE),
		with_original_language: filter.language,
		with_origin_country: filter.origin,
	};
}

function matchesAnimeOrigin(
	item: Record<string, unknown>,
	origin: AnimeOrigin,
): boolean {
	const filter = ANIME_FILTERS[origin];
	const language = String(item.original_language ?? "");
	const genres = (item.genre_ids as number[] | undefined) ?? [];
	const countries = (item.origin_country as string[] | undefined) ?? [];
	const allowed = filter.origin.split("|");
	return (
		language === filter.language &&
		genres.includes(ANIMATION_GENRE) &&
		(countries.length === 0 || countries.some(code => allowed.includes(code)))
	);
}

function animeDiscoverParams(
	media: MediaType,
	origin: AnimeOrigin,
	category: AnimeListCategory,
): Record<string, string> {
	const originParams = animeOriginParams(origin);

	if (category === "top-rated") {
		return {
			...originParams,
			sort_by: "vote_average.desc",
			"vote_count.gte": "50",
		};
	}

	if (category === "upcoming") {
		return media === "movie"
			? {
					...originParams,
					sort_by: "popularity.desc",
					"primary_release_date.gte": isoDateOffset(1),
				}
			: {
					...originParams,
					sort_by: "popularity.desc",
					"first_air_date.gte": isoDateOffset(1),
				};
	}

	if (isDatedBrowseCategory(category)) {
		return { ...originParams, ...datedListParams(media, category) };
	}

	return {
		...originParams,
		sort_by: "popularity.desc",
	};
}

async function discoverAnime(
	media: MediaType,
	origin: AnimeOrigin,
	category: AnimeListCategory,
	page: number,
): Promise<PaginatedResult<MovieType>> {
	const res = await paginated<Record<string, unknown>>(
		media === "tv" ? "/discover/tv" : "/discover/movie",
		{
			page: String(page),
			...animeDiscoverParams(media, origin, category),
		},
	);
	const results = res.results.map(item => toCardItem(item, media));
	return {
		...res,
		results:
			category === "top-rated" ? results : sortByPopularity(results),
	};
}

async function trendingAnime(
	media: MediaType,
	origin: AnimeOrigin,
	page: number,
): Promise<PaginatedResult<MovieType>> {
	const responses = await Promise.all(
		[1, 2, 3, 4, 5].map(sourcePage =>
			paginated<Record<string, unknown>>(
				media === "tv" ? "/trending/tv/week" : "/trending/movie/week",
				{ page: String(sourcePage) },
			),
		),
	);
	const seen = new Set<number>();
	const results = responses
		.flatMap(res => res.results)
		.filter(item => matchesAnimeOrigin(item, origin))
		.map(item => toCardItem(item, media))
		.filter(item => {
			if (seen.has(item.id)) return false;
			seen.add(item.id);
			return true;
		});
	const pageSize = 20;
	const start = (page - 1) * pageSize;
	return {
		results: results.slice(start, start + pageSize),
		page,
		total_pages: Math.max(1, Math.ceil(results.length / pageSize)),
		total_results: results.length,
	};
}

export async function fetchAnimeList(
	origin: AnimeOrigin,
	media: MediaType,
	category: AnimeListCategory = "release-today",
	page = 1,
): Promise<PaginatedResult<MovieType>> {
	if (category === "trending") {
		return trendingAnime(media, origin, page);
	}
	return discoverAnime(media, origin, category, page);
}

export async function fetchAnimeCatalog(
	origin: AnimeOrigin,
	category: AnimeListCategory = "release-today",
	page = 1,
): Promise<PaginatedResult<MovieType>> {
	const [movies, shows] = await Promise.all([
		fetchAnimeList(origin, "movie", category, page),
		fetchAnimeList(origin, "tv", category, page),
	]);
	const seen = new Set<string>();
	const results = [...movies.results, ...shows.results].filter(item => {
		const key = `${item.media_type ?? "movie"}-${item.id}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	const sorted =
		category === "top-rated"
			? [...results].sort(
					(a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0),
				)
			: sortByPopularity(results);
	return {
		results: sorted,
		page,
		total_pages: Math.max(movies.total_pages, shows.total_pages, 1),
		total_results: movies.total_results + shows.total_results,
	};
}

/* ------------------------------ movie & tv -------------------------------- */

export async function fetchMovie(id: string): Promise<MovieType> {
	const movie = await tmdb<MovieType>(`/movie/${id}`, REVALIDATE_HOUR);
	return { ...movie, media_type: "movie" };
}

export async function fetchTv(id: string): Promise<TvDetailType> {
	return tmdb<TvDetailType>(`/tv/${id}`, REVALIDATE_HOUR);
}

export async function fetchReleaseDates(
	movieId: string,
): Promise<{ theatrical: string | null; digital: string | null }> {
	try {
		const data = await tmdb<{
			results: {
				iso_3166_1: string;
				release_dates: { release_date: string; type: number }[];
			}[];
		}>(`/movie/${movieId}/release_dates`, REVALIDATE_HOUR);

		const pick = (type: number): string | null => {
			const region =
				data.results?.find(r => r.iso_3166_1 === "US") ?? data.results?.[0];
			const dates = (region?.release_dates ?? [])
				.filter(rd => rd.type === type && rd.release_date)
				.map(rd => rd.release_date.slice(0, 10))
				.sort();
			return dates[0] ?? null;
		};

		return { theatrical: pick(3), digital: pick(4) };
	} catch {
		return { theatrical: null, digital: null };
	}
}

export async function fetchCast(media: MediaType, id: string): Promise<CastMemberType[]> {
	const data = await tmdb<{ cast: CastMemberType[] }>(
		`/${media}/${id}/credits`,
		REVALIDATE_HOUR,
	);
	return data.cast ?? [];
}

export async function fetchSimilar(media: MediaType, id: string): Promise<MovieType[]> {
	const res = await paginated<Record<string, unknown>>(`/${media}/${id}/similar`);
	return res.results.map(item => toCardItem(item, media));
}

/* --------------------------------- videos --------------------------------- */

export async function fetchVideos(
	media: MediaType,
	id: string,
): Promise<VideoType[]> {
	const data = await tmdb<{ results: VideoType[] }>(
		`/${media}/${id}/videos`,
		REVALIDATE_HOUR,
	);

	const typeRank: Record<string, number> = {
		Trailer: 0,
		Teaser: 1,
		Clip: 2,
		Featurette: 3,
	};
	return (data.results ?? [])
		.filter(v => v.site === "YouTube")
		.sort((a, b) =>
			a.official === b.official
				? (typeRank[a.type] ?? 9) - (typeRank[b.type] ?? 9)
				: a.official
					? -1
					: 1,
		);
}

export async function fetchTrailer(media: MediaType, id: string): Promise<VideoType | null> {
	return (await fetchVideos(media, id))[0] ?? null;
}

/* --------------------------------- reviews -------------------------------- */

export async function fetchReviews(
	media: MediaType,
	id: string,
): Promise<ReviewType[]> {
	const data = await tmdb<{ results: ReviewType[] }>(
		`/${media}/${id}/reviews`,
		REVALIDATE_HOUR,
	);
	return (data.results ?? []).slice(0, 4);
}

/* ------------------------------- providers -------------------------------- */

export async function fetchWatchProviders(
	media: MediaType,
	id: string,
	region = "US",
): Promise<{ providers: ProviderType[]; link: string | null }> {
	try {
		const data = await tmdb<{
			results: Record<string, WatchProvidersType>;
		}>(
			`/${media}/${id}/watch/providers`,
			REVALIDATE_HOUR,
		);

		const upper = region.toUpperCase();
		const reg =
			data.results?.[upper] ?? data.results?.US ?? Object.values(data.results ?? {})[0];
		if (!reg) return { providers: [], link: null };

		const seen = new Set<string>();
		const providers = [
			...(reg.flatrate ?? []),
			...(reg.rent ?? []),
			...(reg.buy ?? []),
			...(reg.ads ?? []),
		]
			.filter(p => p.logo_path && !seen.has(p.provider_name) && seen.add(p.provider_name))
			.sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
			.slice(0, 8);

		return { providers, link: reg.link ?? null };
	} catch {
		return { providers: [], link: null };
	}
}

/* -------------------------------- discover -------------------------------- */

export type DiscoverParams = {
	genres?: string[];
	sortBy?: string;
	dateFrom?: string;
	dateTo?: string;
	minVote?: string;
	maxRuntime?: string;
	page?: number;
};

export async function fetchDiscover({
	genres,
	sortBy = "popularity.desc",
	dateFrom,
	dateTo,
	minVote,
	maxRuntime,
	page = 1,
}: DiscoverParams): Promise<PaginatedResult<MovieType>> {
	const params: Record<string, string> = {
		sort_by: sortBy,
		include_adult: "false",
		"vote_count.gte": sortBy.startsWith("vote_average") ? "200" : "20",
	};

	if (genres?.length) params.with_genres = genres.join(",");
	if (dateFrom) params["primary_release_date.gte"] = `${dateFrom}-01-01`;
	if (dateTo) params["primary_release_date.lte"] = `${dateTo}-12-31`;
	if (minVote) params["vote_average.gte"] = minVote;
	if (maxRuntime) params["with_runtime.lte"] = maxRuntime;

	const res = await paginated<Record<string, unknown>>(
		"/discover/movie",
		{ ...params, page: String(page) },
	);
	return {
		...res,
		results: res.results.map(item => toCardItem(item, "movie")),
	};
}

export async function fetchByGenre(
	id: string,
	opts: { sortBy?: string; page?: number; dateFrom?: string; dateTo?: string } = {},
): Promise<PaginatedResult<MovieType>> {
	return fetchDiscover({
		genres: [id],
		sortBy: opts.sortBy,
		page: opts.page,
		dateFrom: opts.dateFrom,
		dateTo: opts.dateTo,
	});
}

export async function fetchGenres(): Promise<GenreType[]> {
	const data = await tmdb<{ genres: GenreType[] }>("/genre/movie/list", {
		next: { revalidate: 86400 },
	});
	return data.genres ?? [];
}

export async function fetchTrending(): Promise<MovieType[]> {
	const res = await paginated<Record<string, unknown>>("/trending/all/week");
	return res.results
		.filter(item => item.media_type === "movie" || item.media_type === "tv")
		.map(item => toCardItem(item, item.media_type === "tv" ? "tv" : "movie"));
}

/* --------------------------------- search --------------------------------- */

export async function fetchSearchMulti(
	q: string,
	page = 1,
): Promise<PaginatedResult<MovieType>> {
	const [movies, tv] = await Promise.all([
		paginated<Record<string, unknown>>("/search/movie", {
			query: q,
			page: String(page),
			include_adult: "false",
		}),
		paginated<Record<string, unknown>>("/search/tv", {
			query: q,
			page: String(page),
			include_adult: "false",
		}),
	]);

	const seen = new Set<string>();
	const merged = [
		...movies.results.map(item => toCardItem(item, "movie")),
		...tv.results.map(item => toCardItem(item, "tv")),
	]
		.filter(item => {
			const key = `${item.media_type}-${item.id}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

	return {
		results: merged,
		page: Math.max(movies.page, tv.page),
		total_pages: Math.max(movies.total_pages, tv.total_pages),
		total_results: movies.total_results + tv.total_results,
	};
}

/* --------------------------------- people --------------------------------- */

export async function fetchPerson(id: string): Promise<PersonDetailType> {
	return tmdb<PersonDetailType>(`/person/${id}`, REVALIDATE_HOUR);
}

export async function fetchPersonCredits(
	id: string,
): Promise<PersonCreditsType> {
	return tmdb<PersonCreditsType>(`/person/${id}/combined_credits`, REVALIDATE_HOUR);
}

export function creditToCardItem(credit: CreditType): MovieType {
	return {
		id: credit.id,
		media_type: credit.media_type === "tv" ? "tv" : "movie",
		title: String(credit.title ?? credit.name ?? "Untitled"),
		overview: "",
		poster_path: credit.poster_path ?? null,
		backdrop_path: null,
		release_date: credit.release_date ?? credit.first_air_date ?? null,
		vote_average: credit.vote_average ?? 0,
	};
}

export async function fetchPersonKnownFor(id: string): Promise<MovieType[]> {
	const credits = await fetchPersonCredits(id);
	const seen = new Set<string>();

	return [...credits.cast, ...credits.crew]
		.filter(credit => {
			const key = `${credit.media_type === "tv" ? "tv" : "movie"}-${credit.id}`;
			if (!credit.poster_path || seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
		.slice(0, 12)
		.map(creditToCardItem);
}
