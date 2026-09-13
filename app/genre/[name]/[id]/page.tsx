import type { Metadata } from "next";
import { Suspense } from "react";

import CatalogError from "@/components/catalog-error";
import MediaFilters from "@/components/media-filters";
import MovieGrid from "@/components/movie-grid";
import Pagination from "@/components/pagination";
import { fetchByGenre, fetchGenres } from "@/lib/tmdb";
import type { GenreType } from "@/types/global";

type Props = {
	params: Promise<{ name: string; id: string }>;
	searchParams: Promise<{
		page?: string;
		sort?: string;
		from?: string;
		to?: string;
	}>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { name } = await params;
	return { title: `${name} Movies` };
}

export default async function GenrePage({ params, searchParams }: Props) {
	const { id, name } = await params;
	const { page: pageParam, sort, from, to } = await searchParams;

	const page = Math.max(1, Math.min(Number(pageParam) || 1, 500));

	let genres: GenreType[] = [];
	try {
		genres = await fetchGenres();
	} catch (error) {
		console.error("[genre] failed to load genre filters", error);
	}

	let data;
	try {
		data = await fetchByGenre(id, { sortBy: sort, page, dateFrom: from, dateTo: to });
	} catch (error) {
		console.error(`[genre] failed to load genre ${id}`, error);
		return <CatalogError message={`The ${name} catalog could not be loaded.`} />;
	}

	const query: Record<string, string | undefined> = {};
	if (sort) query.sort = sort;
	if (from) query.from = from;
	if (to) query.to = to;

	return (
		<div className="space-y-6">
			<h1 className="text-xl font-bold tracking-tight sm:text-2xl">
				{name} <span className="text-muted-foreground">Movies</span>
			</h1>

			<Suspense
				fallback={<div className="h-[104px] animate-pulse rounded-2xl bg-muted" />}>
				<MediaFilters
					key={`${sort ?? ""}|${from ?? ""}|${to ?? ""}`}
					genres={genres}
					mode="genre"
				/>
			</Suspense>

			<MovieGrid movies={data.results} />

			<Pagination
				page={data.page}
				totalPages={data.total_pages}
				basePath={`/genre/${encodeURIComponent(name)}/${id}`}
				query={query}
			/>
		</div>
	);
}
