import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
	CalendarDays,
	Clapperboard,
	Compass,
	Film,
	Flame,
	Star,
	TrendingUp,
	Tv,
} from "lucide-react";

import MovieGrid from "@/components/movie-grid";
import SectionHeading from "@/components/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getWatchlist } from "@/lib/db";
import {
	fetchMediaList,
	fetchSimilar,
	fetchTrending,
	imageUrl,
	year,
} from "@/lib/tmdb";
import type { MediaCategory } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import type { MovieType, PaginatedResult, MediaType } from "@/types/global";

const PREVIEW_COUNT = 10;

async function safeMediaList(
	media: MediaType,
	category: MediaCategory,
): Promise<PaginatedResult<MovieType>> {
	try {
		return await fetchMediaList(media, category);
	} catch (error) {
		console.error(`[home] failed to load ${media}/${category}`, error);
		return {
			results: [],
			page: 1,
			total_pages: 1,
			total_results: 0,
		};
	}
}

async function safeTrending(): Promise<MovieType[]> {
	try {
		return await fetchTrending();
	} catch (error) {
		console.error("[home] failed to load trending titles", error);
		return [];
	}
}

function Hero({ movie }: { movie: MovieType }) {
	const backdrop = imageUrl(movie.backdrop_path ?? movie.poster_path, "w1280");

	return (
		<section className="relative mb-10 overflow-hidden rounded-2xl border border-border/60 sm:mb-14">
			<div className="relative h-72 w-full sm:h-96 lg:h-[28rem]">
				{backdrop && (
					<Image
						src={backdrop}
						alt=""
						fill
						priority
						sizes="(min-width: 1440px) 1136px, (min-width: 1024px) calc(100vw - 304px), (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
						className="object-cover"
					/>
				)}
				<div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
				<div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
			</div>

			<div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10">
				<span className="mb-3 inline-block rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary backdrop-blur-sm">
					Featured
				</span>
				<h1 className="text-balance max-w-2xl text-3xl font-extrabold tracking-tight drop-shadow-lg sm:text-4xl lg:text-5xl">
					{movie.title}
				</h1>
				<div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
					<span className="inline-flex items-center gap-1.5 font-semibold text-amber-400">
						<Star className="size-4 fill-amber-400" />
						{movie.vote_average.toFixed(1)}
					</span>
					<span className="inline-flex items-center gap-1.5">
						<CalendarDays className="size-4" />
						{year(movie.release_date)}
					</span>
				</div>
				<p className="mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:line-clamp-3">
					{movie.overview}
				</p>
				<div className="mt-5 flex flex-wrap gap-3">
					<Link
						href={movie.media_type === "tv" ? `/tv/${movie.id}` : `/detail/${movie.id}`}
						className={cn(buttonVariants({ size: "lg" }), "shadow-lg shadow-primary/30")}>
						View details
					</Link>
					<Link
						href="/browse/movies/upcoming"
						className={buttonVariants({ variant: "outline", size: "lg" })}>
						Coming soon
					</Link>
				</div>
			</div>
		</section>
	);
}

async function ForYou() {
	const user = await getCurrentUser();
	if (!user) return null;

	const watchlist = await getWatchlist(user.id);
	if (!watchlist.length) return null;

	const seed = watchlist[0];
	let similar: MovieType[] = [];
	try {
		similar = await fetchSimilar(seed.media_type as "movie" | "tv", String(seed.media_id));
	} catch {
		return null;
	}
	if (!similar.length) return null;

	return (
		<section>
			<SectionHeading
				icon={<Compass className="size-4.5" />}
				title="Because you saved"
				href={seed.media_type === "tv" ? `/tv/${seed.media_id}` : `/detail/${seed.media_id}`}
				linkLabel={seed.title}
			/>
			<MovieGrid movies={similar.slice(0, PREVIEW_COUNT)} className="mt-5" />
		</section>
	);
}

export default async function Home() {
	const [popular, upcoming, topRated, nowPlaying, tvPopular, trending] =
		await Promise.all([
			safeMediaList("movie", "popular"),
			safeMediaList("movie", "upcoming"),
			safeMediaList("movie", "top-rated"),
			safeMediaList("movie", "now-playing"),
			safeMediaList("tv", "popular"),
			safeTrending(),
		]);

	const featured = popular.results[0];
	const hasCatalogData =
		popular.results.length > 0 ||
		upcoming.results.length > 0 ||
		topRated.results.length > 0 ||
		nowPlaying.results.length > 0 ||
		tvPopular.results.length > 0 ||
		trending.length > 0;

	if (!hasCatalogData) {
		return (
			<div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-8 text-center">
				<Film className="size-8 text-muted-foreground" />
				<h1 className="text-xl font-bold">Catalog temporarily unavailable</h1>
				<p className="max-w-md text-sm text-muted-foreground">
					Movie data could not be loaded. Please refresh in a moment.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-12 sm:space-y-14">
			{featured && <Hero movie={featured} />}

			{trending.length > 0 && <section>
				<SectionHeading
					icon={<Flame className="size-4.5" />}
					title="Trending this week"
					href="/browse/movies/trending"
				/>
				<MovieGrid movies={trending.slice(0, PREVIEW_COUNT)} className="mt-5" />
			</section>}

			<Suspense fallback={null}>
				<ForYou />
			</Suspense>

			{popular.results.length > 0 && <section>
				<SectionHeading
					icon={<TrendingUp className="size-4.5" />}
					title="Popular"
					href="/browse/movies/popular"
				/>
				<MovieGrid movies={popular.results.slice(0, PREVIEW_COUNT)} className="mt-5" />
			</section>}

			{upcoming.results.length > 0 && <section id="upcoming" className="scroll-mt-24">
				<SectionHeading
					icon={<CalendarDays className="size-4.5" />}
					title="Coming soon"
					href="/browse/movies/upcoming"
				/>
				<MovieGrid movies={upcoming.results.slice(0, PREVIEW_COUNT)} className="mt-5" />
			</section>}

			{topRated.results.length > 0 && <section>
				<SectionHeading
					icon={<Star className="size-4.5" />}
					title="Top rated"
					href="/browse/movies/top-rated"
				/>
				<MovieGrid movies={topRated.results.slice(0, PREVIEW_COUNT)} className="mt-5" />
			</section>}

			{nowPlaying.results.length > 0 && <section>
				<SectionHeading
					icon={<Film className="size-4.5" />}
					title="In theaters"
					href="/browse/movies/now-playing"
				/>
				<MovieGrid movies={nowPlaying.results.slice(0, PREVIEW_COUNT)} className="mt-5" />
			</section>}

			{tvPopular.results.length > 0 && <section>
				<SectionHeading
					icon={<Tv className="size-4.5" />}
					title="Popular shows"
					href="/browse/tv/popular"
				/>
				<MovieGrid movies={tvPopular.results.slice(0, PREVIEW_COUNT)} className="mt-5" />
			</section>}

			<section className="flex flex-col items-center gap-4 rounded-2xl border border-dashed py-12 text-center">
				<span className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
					<Film className="size-5" />
				</span>
				<div>
					<h2 className="text-lg font-bold">Looking for something specific?</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Browse by mood with the full discover filters.
					</p>
				</div>
				<Link href="/discover" className={buttonVariants()}>
					<Clapperboard className="size-4" />
					Open Discover
				</Link>
			</section>
		</div>
	);
}
