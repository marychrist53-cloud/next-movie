"use client";

import { useEffect, useRef } from "react";

import { importLocalDataAction } from "@/app/actions/library";
import { useLibrary } from "@/components/library-provider";
import {
	isValidLibraryItem,
	isValidRating,
	type LibraryItemInput,
	type RatingInput,
} from "@/lib/library-validation";

const SYNC_FLAG = "nm-synced";
const MAX_ATTEMPTS = 3;

function readLibraryItems(key: string, usesLegacyId: boolean): LibraryItemInput[] {
	const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
	if (!Array.isArray(parsed)) return [];

	const items: LibraryItemInput[] = [];
	for (const value of parsed) {
		if (!value || typeof value !== "object") continue;
		const item = value as Record<string, unknown>;
		const candidate = {
			media_type: item.media_type,
			media_id: usesLegacyId ? item.id : item.media_id,
			title: item.title,
			poster_path: item.poster_path,
			release_date: item.release_date,
			vote_average: item.vote_average,
		} as LibraryItemInput;
		if (isValidLibraryItem(candidate)) items.push(candidate);
	}
	return items;
}

function readRatings(): RatingInput[] {
	const parsed: unknown = JSON.parse(localStorage.getItem("nm-ratings") ?? "{}");
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];

	const ratings: RatingInput[] = [];
	for (const [key, value] of Object.entries(parsed)) {
		const separator = key.lastIndexOf("-");
		const candidate = {
			mediaType: key.slice(0, separator),
			id: Number(key.slice(separator + 1)),
			rating: Number(value),
		} as RatingInput;
		if (isValidRating(candidate)) ratings.push(candidate);
	}
	return ratings;
}

function wait(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function importWithRetry(
	watchlist: LibraryItemInput[],
	ratings: RatingInput[],
	favorites: LibraryItemInput[],
) {
	let lastError: unknown;
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		try {
			const result = await importLocalDataAction(watchlist, ratings, favorites);
			if (!result.error) return result;
			lastError = result.error;
		} catch (error) {
			lastError = error;
		}
		if (attempt < MAX_ATTEMPTS - 1) {
			await wait(400 * 2 ** attempt);
		}
	}
	throw lastError instanceof Error
		? lastError
		: new Error(typeof lastError === "string" ? lastError : "Import failed");
}

export default function WatchlistSync() {
	const { user } = useLibrary();
	const attemptedForUser = useRef<number | null>(null);
	const inFlight = useRef(false);

	useEffect(() => {
		if (!user) return;
		if (attemptedForUser.current === user.id || inFlight.current) return;

		const syncKey = `${SYNC_FLAG}:${user.id}`;
		try {
			if (sessionStorage.getItem(syncKey)) {
				attemptedForUser.current = user.id;
				return;
			}
		} catch (error) {
			console.error("[library] could not read sync state", error);
		}

		let watchlist: LibraryItemInput[] = [];
		let favorites: LibraryItemInput[] = [];
		let ratings: RatingInput[] = [];

		try {
			watchlist = readLibraryItems("nm-watchlist", true);
			favorites = readLibraryItems("nm-favorites", false);
			ratings = readRatings();
		} catch (error) {
			console.error("[library] could not read local data", error);
			return;
		}

		if (!watchlist.length && !favorites.length && !ratings.length) {
			try {
				sessionStorage.setItem(syncKey, "1");
				attemptedForUser.current = user.id;
			} catch (error) {
				console.error("[library] could not save sync state", error);
			}
			return;
		}

		inFlight.current = true;
		void importWithRetry(watchlist, ratings, favorites)
			.then(() => {
				localStorage.removeItem("nm-watchlist");
				localStorage.removeItem("nm-ratings");
				localStorage.removeItem("nm-favorites");
				sessionStorage.setItem(syncKey, "1");
				attemptedForUser.current = user.id;
				window.dispatchEvent(new Event("nm-watchlist-changed"));
				window.dispatchEvent(new Event("nm-ratings-changed"));
				window.dispatchEvent(new Event("nm-favorites-changed"));
				window.location.reload();
			})
			.catch(error => {
				console.error("[library] local data import failed", error);
			})
			.finally(() => {
				inFlight.current = false;
			});
	}, [user]);

	return null;
}
