"use client";

import { useSyncExternalStore } from "react";

import { isValidLibraryItem } from "@/lib/library-validation";
import type { MediaType } from "@/types/global";

const STORAGE_KEY = "nm-watchlist";
const CHANGE_EVENT = "nm-watchlist-changed";

export type WatchlistItem = {
	id: number;
	media_type: MediaType;
	title: string;
	poster_path: string | null;
	release_date: string | null;
	vote_average: number;
};

const EMPTY: WatchlistItem[] = [];

let cachedRaw: string | null = null;
let cachedItems: WatchlistItem[] = EMPTY;

function isWatchlistItem(value: unknown): value is WatchlistItem {
	if (!value || typeof value !== "object") return false;
	const item = value as Partial<WatchlistItem>;
	return isValidLibraryItem({
		media_type: item.media_type as MediaType,
		media_id: item.id as number,
		title: item.title as string,
		poster_path: item.poster_path as string | null,
		release_date: item.release_date as string | null,
		vote_average: item.vote_average as number,
	});
}

function getSnapshot(): WatchlistItem[] {
	let raw: string | null = null;
	try {
		raw = localStorage.getItem(STORAGE_KEY);
	} catch {}

	if (raw !== cachedRaw) {
		let parsed: unknown = [];
		try {
			parsed = raw ? JSON.parse(raw) : [];
		} catch {}
		cachedItems = Array.isArray(parsed)
			? parsed.filter(isWatchlistItem)
			: [];
		cachedRaw = raw;
	}
	return cachedItems;
}

function getServerSnapshot(): WatchlistItem[] {
	return EMPTY;
}

function subscribe(callback: () => void) {
	window.addEventListener("storage", callback);
	window.addEventListener(CHANGE_EVENT, callback);
	return () => {
		window.removeEventListener("storage", callback);
		window.removeEventListener(CHANGE_EVENT, callback);
	};
}

export function watchlistKey(mediaType: MediaType, id: number) {
	return `${mediaType}-${id}`;
}

export function useWatchlistItems(): WatchlistItem[] {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useWatchlistIds(): Set<string> {
	const items = useWatchlistItems();
	return new Set(items.map(item => watchlistKey(item.media_type, item.id)));
}

export function useInWatchlist(
	mediaType: MediaType,
	id: number,
): boolean {
	return useWatchlistIds().has(watchlistKey(mediaType, id));
}

export function toggleWatchlist(item: WatchlistItem): void {
	const items = getSnapshot();
	const key = watchlistKey(item.media_type, item.id);
	const next = items.some(
		existing => watchlistKey(existing.media_type, existing.id) === key,
	)
		? items.filter(
				existing =>
					watchlistKey(existing.media_type, existing.id) !== key,
			)
		: [item, ...items];

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {}

	window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useWatchlistCount(): number {
	return useWatchlistItems().length;
}
