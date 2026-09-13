import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CatalogError from "@/components/catalog-error";
import MovieGrid from "@/components/movie-grid";
import Pagination from "@/components/pagination";
import {
	ANIME_LIST_CATEGORIES,
	ANIME_ORIGINS,
	fetchAnimeCatalog,
	isDatedBrowseCategory,
	type AnimeListCategory,
	type AnimeOrigin,
} from "@/lib/tmdb";

const ORIGIN_LABELS: Record<AnimeOrigin, string> = {
	japanese: "Japanese Anime",
	chinese: "Chinese Anime",
};

const CATEGORY_LABELS: Record<AnimeListCategory, string> = {
	"release-today": "Release Today",
	"top-rated": "Top Rated",
	trending: "Trending",
	upcoming: "Upcoming",
};

function categorySubtitle(category: AnimeListCategory): string {
	if (category === "release-today") {
		return "Movies and series releasing today · sorted by popularity";
	}
	if (category === "trending") return "This week's trending movies and series";
	if (category === "upcoming") return "Upcoming movies and series";
	return "Highest rated movies and series";
}

type Props = {
	params: Promise<{ origin: string; category: string }>;
	searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { origin, category } = await params;
	const originLabel = ORIGIN_LABELS[origin as AnimeOrigin] ?? "Anime";
	const categoryLabel =
		CATEGORY_LABELS[category as AnimeListCategory] ?? category;
	return { title: `${categoryLabel} ${originLabel}` };
}

function formatFullDate(date: string | null): string | undefined {
	if (!date) return undefined;
	return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
}

export default async function AnimeBrowsePage({ params, searchParams }: Props) {
	const { origin, category } = await params;
	const { page: pageParam } = await searchParams;

	if (
		!ANIME_ORIGINS.includes(origin as AnimeOrigin) ||
		!ANIME_LIST_CATEGORIES.includes(category as AnimeListCategory)
	) {
		notFound();
	}

	const animeOrigin = origin as AnimeOrigin;
	const listCategory = category as AnimeListCategory;
	const page = Math.max(1, Math.min(Number(pageParam) || 1, 500));

	let data;
	try {
		data = await fetchAnimeCatalog(animeOrigin, listCategory, page);
	} catch (error) {
		console.error(`[browse] failed to load anime/${origin}/${category}`, error);
		return (
			<CatalogError
				message={`The ${CATEGORY_LABELS[listCategory].toLowerCase()} ${ORIGIN_LABELS[animeOrigin].toLowerCase()} list could not be loaded.`}
			/>
		);
	}

	const showFullDate =
		listCategory === "upcoming" || isDatedBrowseCategory(listCategory);

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-xl font-bold tracking-tight sm:text-2xl">
					{CATEGORY_LABELS[listCategory]}{" "}
					<span className="text-muted-foreground">
						{ORIGIN_LABELS[animeOrigin]}
					</span>
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					{data.total_results.toLocaleString()} titles · page {data.page} of{" "}
					{data.total_pages} · {categorySubtitle(listCategory)}
				</p>
			</header>

			<MovieGrid
				movies={data.results}
				metaFor={
					showFullDate
						? movie => formatFullDate(movie.release_date) ?? "Date TBA"
						: undefined
				}
			/>

			<Pagination
				page={data.page}
				totalPages={data.total_pages}
				basePath={`/browse/anime/${origin}/${category}`}
			/>
		</div>
	);
}
