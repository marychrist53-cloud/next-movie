export type MediaType = "movie" | "tv";

export type GenreType = {
	id: number;
	name: string;
};

export type MovieType = {
	id: number;
	media_type?: MediaType;
	title: string;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	release_date: string | null;
	vote_average: number;
	vote_count?: number;
	popularity?: number;
	genre_ids?: number[];
	genres?: GenreType[];
	runtime?: number | null;
	tagline?: string | null;
	status?: string;
};

export type CastMemberType = {
	id: number;
	name: string;
	character: string;
	profile_path: string | null;
	order?: number;
};

export type PersonDetailType = {
	id: number;
	name: string;
	biography: string | null;
	birthday: string | null;
	deathday: string | null;
	place_of_birth: string | null;
	known_for_department: string | null;
	profile_path: string | null;
};

export type CreditType = {
	id: number;
	media_type?: MediaType;
	title?: string | null;
	name?: string | null;
	poster_path: string | null;
	backdrop_path?: string | null;
	vote_average: number;
	release_date: string | null;
	first_air_date?: string | null;
	popularity?: number;
	department?: string | null;
	job?: string | null;
	character?: string | null;
};

export type PersonCreditsType = {
	cast: CreditType[];
	crew: CreditType[];
};

export type VideoType = {
	id: string;
	key: string;
	name: string;
	site: string;
	type: string;
	official: boolean;
	published_at?: string;
};

export type ReviewType = {
	id: string;
	author: string;
	content: string;
	created_at: string;
	author_details?: {
		name?: string | null;
		username?: string | null;
		avatar_path?: string | null;
		rating?: number | null;
	};
};

export type ProviderType = {
	logo_path: string | null;
	provider_name: string;
	display_priority?: number;
};

export type WatchProvidersType = {
	link?: string;
	free?: ProviderType[];
	ads?: ProviderType[];
	flatrate?: ProviderType[];
	buy?: ProviderType[];
	rent?: ProviderType[];
};

export type SeasonType = {
	id: number;
	name: string;
	air_date: string | null;
	episode_count: number;
	season_number: number;
	overview: string | null;
	poster_path: string | null;
};

export type EpisodeType = {
	id: number;
	name: string | null;
	air_date: string | null;
	episode_number: number;
	season_number: number;
};

export type TvDetailType = {
	id: number;
	name: string;
	tagline?: string | null;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	first_air_date: string | null;
	vote_average: number;
	vote_count?: number;
	genres?: GenreType[];
	episode_run_time?: number[];
	number_of_seasons?: number;
	number_of_episodes?: number;
	status?: string;
	seasons?: SeasonType[];
	next_episode_to_air?: EpisodeType | null;
	last_episode_to_air?: EpisodeType | null;
};

export type PaginatedResult<T> = {
	results: T[];
	page: number;
	total_pages: number;
	total_results: number;
};
