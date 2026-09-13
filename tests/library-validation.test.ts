import { describe, expect, it } from "vitest";

import {
	isMediaType,
	isValidLibraryItem,
	isValidRating,
} from "@/lib/library-validation";

const validItem = {
	media_type: "movie" as const,
	media_id: 123,
	title: "Example",
	poster_path: "/poster.jpg",
	release_date: "2026-09-06",
	vote_average: 7.5,
};

describe("library validation", () => {
	it("accepts valid movie and TV media types", () => {
		expect(isMediaType("movie")).toBe(true);
		expect(isMediaType("tv")).toBe(true);
		expect(isMediaType("person")).toBe(false);
	});

	it("accepts a valid library item", () => {
		expect(isValidLibraryItem(validItem)).toBe(true);
	});

	it("rejects malformed and oversized library data", () => {
		expect(isValidLibraryItem({ ...validItem, media_id: -1 })).toBe(false);
		expect(isValidLibraryItem({ ...validItem, title: "" })).toBe(false);
		expect(
			isValidLibraryItem({ ...validItem, poster_path: "https://evil.test/x" }),
		).toBe(false);
		expect(
			isValidLibraryItem({ ...validItem, release_date: "not-a-date" }),
		).toBe(false);
		expect(isValidLibraryItem({ ...validItem, vote_average: 11 })).toBe(false);
	});

	it("validates imported ratings", () => {
		expect(isValidRating({ mediaType: "tv", id: 42, rating: 8 })).toBe(true);
		expect(isValidRating({ mediaType: "tv", id: 42, rating: 11 })).toBe(false);
		expect(isValidRating({ mediaType: "movie", id: 0, rating: 8 })).toBe(false);
	});
});
