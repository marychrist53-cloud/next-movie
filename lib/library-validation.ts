import type { MediaType } from "@/types/global";

export type LibraryItemInput = {
	media_type: MediaType;
	media_id: number;
	title: string;
	poster_path: string | null;
	release_date: string | null;
	vote_average: number;
};

export type RatingInput = {
	mediaType: MediaType;
	id: number;
	rating: number;
};

export function isMediaType(value: unknown): value is MediaType {
	return value === "movie" || value === "tv";
}

export function isValidLibraryItem(
	item: LibraryItemInput | null | undefined,
): item is LibraryItemInput {
	return !!(
		item &&
		isMediaType(item.media_type) &&
		Number.isInteger(item.media_id) &&
		item.media_id > 0 &&
		typeof item.title === "string" &&
		item.title.trim().length > 0 &&
		item.title.length <= 300 &&
		(item.poster_path === null ||
			(typeof item.poster_path === "string" &&
				item.poster_path.length <= 300 &&
				item.poster_path.startsWith("/"))) &&
		(item.release_date === null ||
			(typeof item.release_date === "string" &&
				/^\d{4}-\d{2}-\d{2}$/.test(item.release_date))) &&
		Number.isFinite(item.vote_average) &&
		item.vote_average >= 0 &&
		item.vote_average <= 10
	);
}

export function isValidRating(
	item: RatingInput | null | undefined,
): item is RatingInput {
	return !!(
		item &&
		isMediaType(item.mediaType) &&
		Number.isInteger(item.id) &&
		item.id > 0 &&
		Number.isInteger(item.rating) &&
		item.rating >= 1 &&
		item.rating <= 10
	);
}
