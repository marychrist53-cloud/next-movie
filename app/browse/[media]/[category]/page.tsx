import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import CatalogError from "@/components/catalog-error";
import MovieGrid from "@/components/movie-grid";
import Pagination from "@/components/pagination";
import {
	ANIME_ORIGINS,
	fetchMediaList,
	isDatedBrowseCategory,
	MOVIE_CATEGORIES,
	TV_CATEGORIES,
	type AnimeOrigin,
	type MediaCategory,
} from "@/lib/tmdb";
import type { MediaType } from "@/types/global";

const LABELS: Record<MediaCategory, string> = {
	popular: "Popular",
	"top-rated": "Top Rated",
	"now-playing": "Now Playing",
	upcoming: "Upcoming",
	"on-the-air": "On the Air",
	"release-today": "Release Today",
	"theatrical-today": "Theatrical Today",
	"digital-today": "Digital Today",
	trending: "Trending",
};

function datedSubtitle(media: MediaType, category: MediaCategory): string {
	if (category === "theatrical-today") {
		return media === "tv"
			? "Episodes airing today · sorted by popularity"
			: "Cinema releases today · sorted by popularity";
	}
	if (category === "digital-today") {
		return media === "tv"
			? "New series premiering today · sorted by popularity"
			: "Digital and VOD releases today · sorted by popularity";
	}
	return "Sorted by popularity";
}

type Props = {
	params: Promise<{ media: string; category: string }>;
	searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { media, category } = await params;
	const label = LABELS[category as MediaCategory] ?? category;
	return { title: `${label} ${media === "tv" ? "Shows" : "Movies"}` };
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

export default async function BrowsePage({ params, searchParams }: Props) {
	const { media, category } = await params;
	const { page: pageParam } = await searchParams;
	const page = Math.max(1, Math.min(Number(pageParam) || 1, 500));

	if (media === "anime") {
		if (ANIME_ORIGINS.includes(category as AnimeOrigin)) {
			redirect(`/browse/anime/${category}/release-today`);
		}
		notFound();
	}

	const validCategories =
		media === "tv"
			? TV_CATEGORIES
			: media === "movies"
				? MOVIE_CATEGORIES
				: null;

	if (!validCategories || !validCategories.includes(category as MediaCategory)) {
		notFound();
	}

	const mediaType: MediaType = media === "tv" ? "tv" : "movie";
	const mediaCategory = category as MediaCategory;

	let data;
	try {
		data = await fetchMediaList(mediaType, mediaCategory, page);
	} catch (error) {
		console.error(`[browse] failed to load ${media}/${category}`, error);
		return (
			<CatalogError message={`The ${LABELS[mediaCategory].toLowerCase()} list could not be loaded.`} />
		);
	}

	const basePath = `/browse/${media}/${category}`;
	const showFullDate =
		(media === "movies" && category === "upcoming") ||
		isDatedBrowseCategory(category);

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-xl font-bold tracking-tight sm:text-2xl">
					{LABELS[mediaCategory]}{" "}
					<span className="text-muted-foreground">
						{media === "tv" ? "TV Shows" : "Movies"}
					</span>
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					{data.total_results.toLocaleString()} titles · page {data.page} of{" "}
					{data.total_pages}
					{isDatedBrowseCategory(category)
						? ` · ${datedSubtitle(mediaType, mediaCategory)}`
						: ""}
				</p>
			</header>

			<MovieGrid
				movies={data.results}
				metaFor={
					showFullDate
						? movie =>
								formatFullDate(movie.release_date) ?? "Date TBA"
						: undefined
				}
			/>

			<Pagination
				page={data.page}
				totalPages={data.total_pages}
				basePath={basePath}
			/>
		</div>
	);
}
