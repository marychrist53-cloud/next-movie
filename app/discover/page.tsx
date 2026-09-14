import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { Suspense } from "react";

import CatalogError from "@/components/catalog-error";
import MediaFilters from "@/components/media-filters";
import MovieGrid from "@/components/movie-grid";
import Pagination from "@/components/pagination";
import { fetchDiscover, fetchGenres } from "@/lib/tmdb";
import type { GenreType } from "@/types/global";

export const metadata: Metadata = { title: "Discover" };

type Props = {
	searchParams: Promise<{
		page?: string;
		sort?: string;
		from?: string;
		to?: string;
		genres?: string;
		vote?: string;
		runtime?: string;
		provider?: string;
		region?: string;
	}>;
};

export default async function DiscoverPage({ searchParams }: Props) {
	const {
		page: pageParam,
		sort,
		from,
		to,
		genres: genresParam,
		vote,
		runtime,
		provider,
		region,
	} = await searchParams;

	const page = Math.max(1, Math.min(Number(pageParam) || 1, 500));

	let allGenres: GenreType[] = [];
	try {
		allGenres = await fetchGenres();
	} catch (error) {
		console.error("[discover] failed to load genres", error);
	}

	let data;
	try {
		data = await fetchDiscover({
			genres: genresParam?.split(",").filter(Boolean),
			sortBy: sort,
			dateFrom: from,
			dateTo: to,
			minVote: vote,
			maxRuntime: runtime,
			watchProviders: provider?.split(",").filter(Boolean),
			watchRegion: region,
			page,
		});
	} catch (error) {
		console.error("[discover] failed to load results", error);
		return (
			<CatalogError message="Your discovery results could not be loaded." />
		);
	}

	const query: Record<string, string | undefined> = {};
	if (sort) query.sort = sort;
	if (from) query.from = from;
	if (to) query.to = to;
	if (genresParam) query.genres = genresParam;
	if (vote) query.vote = vote;
	if (runtime) query.runtime = runtime;
	if (provider) query.provider = provider;
	if (region) query.region = region;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight sm:text-2xl">
					<span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
						<Compass className="size-4.5" />
					</span>
					Discover
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Mix genres, years, ratings, runtime and streaming services to find your match.
				</p>
			</div>

			<Suspense
				fallback={<div className="h-[104px] animate-pulse rounded-2xl bg-muted" />}>
				<MediaFilters
					key={`${genresParam ?? ""}|${sort ?? ""}|${from ?? ""}|${to ?? ""}|${vote ?? ""}|${runtime ?? ""}|${provider ?? ""}|${region ?? ""}`}
					genres={allGenres}
					mode="discover"
				/>
			</Suspense>

			<MovieGrid movies={data.results} />

			<Pagination
				page={data.page}
				totalPages={data.total_pages}
				basePath="/discover"
				query={query}
			/>
		</div>
	);
}
