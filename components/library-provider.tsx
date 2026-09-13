"use client";

import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";

import {
	toggleWatchlist as toggleLocalWatchlist,
	useWatchlistItems as useLocalWatchlistItems,
} from "@/components/watchlist-store";
import {
	toggleFavoriteAction,
	toggleWatchlistAction,
} from "@/app/actions/library";
import { isValidLibraryItem } from "@/lib/library-validation";
import type { MediaType } from "@/types/global";

export type SessionUser = { id: number; name: string; email: string };

export type LibraryItem = {
	media_type: MediaType;
	media_id: number;
	title: string;
	poster_path: string | null;
	release_date: string | null;
	vote_average: number;
};

type LibraryContextValue = {
	user: SessionUser | null;
	isReady: boolean;
	watchlistHas: (mediaType: MediaType, id: number) => boolean;
	favoriteHas: (mediaType: MediaType, id: number) => boolean;
	toggleWatchlist: (item: LibraryItem) => void;
	toggleFavorite: (item: LibraryItem) => void;
	watchlistCount: number;
	favoriteCount: number;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function useLocalFavorites(): {
	ids: Set<string>;
	isReady: boolean;
	toggle: (item: LibraryItem) => void;
} {
	const subscribe = useCallback((cb: () => void) => {
		window.addEventListener("nm-favorites-changed", cb);
		window.addEventListener("storage", cb);
		return () => {
			window.removeEventListener("nm-favorites-changed", cb);
			window.removeEventListener("storage", cb);
		};
	}, []);

	const raw = useSyncExternalStore(
		subscribe,
		() => {
			try {
				return localStorage.getItem("nm-favorites") ?? "[]";
			} catch {
				return "[]";
			}
		},
		() => "[]",
	);

	const ids = useMemo(() => {
		const set = new Set<string>();
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				for (const i of parsed) {
					if (isValidLibraryItem(i)) {
						set.add(`${i.media_type}-${i.media_id}`);
					}
				}
			}
		} catch {}
		return set;
	}, [raw]);

	const toggle = useCallback((item: LibraryItem) => {
		let current: LibraryItem[] = [];
		try {
			const parsed: unknown = JSON.parse(
				localStorage.getItem("nm-favorites") ?? "[]",
			);
			if (Array.isArray(parsed)) {
				current = parsed.filter(isValidLibraryItem);
			}
		} catch {}
		const key = `${item.media_type}-${item.media_id}`;
		const next = current.some(i => `${i.media_type}-${i.media_id}` === key)
			? current.filter(i => `${i.media_type}-${i.media_id}` !== key)
			: [item, ...current];
		try {
			localStorage.setItem("nm-favorites", JSON.stringify(next));
		} catch {}
		window.dispatchEvent(new Event("nm-favorites-changed"));
	}, []);

	return { ids, isReady: true, toggle };
}

function useIdSet(initial: string[]): [Set<string>, (key: string) => void] {
	const [ids, setIds] = useState(() => new Set(initial));

	const flip = useCallback((key: string) => {
		setIds(prev => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	return [ids, flip];
}

export function LibraryProvider({
	user,
	initialWatchlistIds,
	initialFavoriteIds,
	children,
}: {
	user: SessionUser | null;
	initialWatchlistIds: string[];
	initialFavoriteIds: string[];
	children: React.ReactNode;
}) {
	const localWatchlist = useLocalWatchlistItems();
	const localFavorites = useLocalFavorites();

	const [watchIds, flipWatch] = useIdSet(initialWatchlistIds);
	const [favIds, flipFav] = useIdSet(initialFavoriteIds);

	const value = useMemo<LibraryContextValue>(() => {
		if (user) {
			return {
				user,
				isReady: true,
				watchlistHas: (mediaType, id) => watchIds.has(`${mediaType}-${id}`),
				favoriteHas: (mediaType, id) => favIds.has(`${mediaType}-${id}`),
				watchlistCount: watchIds.size,
				favoriteCount: favIds.size,
				toggleWatchlist: item => {
					const key = `${item.media_type}-${item.media_id}`;
					flipWatch(key);
					void toggleWatchlistAction(item)
						.then(result => {
							if (result.error) flipWatch(key);
						})
						.catch(error => {
							console.error("[library] watchlist update failed", error);
							flipWatch(key);
						});
				},
				toggleFavorite: item => {
					const key = `${item.media_type}-${item.media_id}`;
					flipFav(key);
					void toggleFavoriteAction(item)
						.then(result => {
							if (result.error) flipFav(key);
						})
						.catch(error => {
							console.error("[library] favorite update failed", error);
							flipFav(key);
						});
				},
			};
		}

		const guestWatchIds = new Set(
			localWatchlist.map(i => `${i.media_type}-${i.id}`),
		);

		return {
			user: null,
			isReady: true,
			watchlistHas: (mediaType, id) =>
				guestWatchIds.has(`${mediaType}-${id}`),
			favoriteHas: (mediaType, id) =>
				localFavorites.ids.has(`${mediaType}-${id}`),
			watchlistCount: localWatchlist.length,
			favoriteCount: localFavorites.ids.size,
			toggleWatchlist: item =>
				toggleLocalWatchlist({
					id: item.media_id,
					media_type: item.media_type,
					title: item.title,
					poster_path: item.poster_path,
					release_date: item.release_date,
					vote_average: item.vote_average,
				}),
			toggleFavorite: localFavorites.toggle,
		};
	}, [
		user,
		watchIds,
		favIds,
		flipWatch,
		flipFav,
		localWatchlist,
		localFavorites,
	]);

	return (
		<LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
	);
}

export function useLibrary(): LibraryContextValue {
	const ctx = useContext(LibraryContext);
	if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
	return ctx;
}
