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
	toggleWatchedAction,
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
	watchedHas: (mediaType: MediaType, id: number) => boolean;
	toggleWatchlist: (item: LibraryItem) => void;
	toggleFavorite: (item: LibraryItem) => void;
	toggleWatched: (item: LibraryItem) => void;
	watchlistCount: number;
	favoriteCount: number;
	watchedCount: number;
	hydrateAccount: (input: {
		user: SessionUser | null;
		watchlistIds: string[];
		favoriteIds: string[];
		watchedIds: string[];
	}) => void;
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

function useLocalWatched(): {
	ids: Set<string>;
	isReady: boolean;
	toggle: (item: LibraryItem) => void;
} {
	const subscribe = useCallback((cb: () => void) => {
		window.addEventListener("nm-watched-changed", cb);
		window.addEventListener("storage", cb);
		return () => {
			window.removeEventListener("nm-watched-changed", cb);
			window.removeEventListener("storage", cb);
		};
	}, []);

	const raw = useSyncExternalStore(
		subscribe,
		() => {
			try {
				return localStorage.getItem("nm-watched") ?? "[]";
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
				localStorage.getItem("nm-watched") ?? "[]",
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
			localStorage.setItem("nm-watched", JSON.stringify(next));
		} catch {}
		window.dispatchEvent(new Event("nm-watched-changed"));
	}, []);

	return { ids, isReady: true, toggle };
}

function useIdSet(initial: string[]): {
	ids: Set<string>;
	flip: (key: string) => void;
	replace: (next: string[]) => void;
} {
	const [ids, setIds] = useState(() => new Set(initial));

	const flip = useCallback((key: string) => {
		setIds(prev => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	const replace = useCallback((next: string[]) => {
		setIds(new Set(next));
	}, []);

	return { ids, flip, replace };
}

export function LibraryProvider({
	user,
	initialWatchlistIds,
	initialFavoriteIds,
	initialWatchedIds,
	children,
}: {
	user: SessionUser | null;
	initialWatchlistIds: string[];
	initialFavoriteIds: string[];
	initialWatchedIds: string[];
	children: React.ReactNode;
}) {
	const localWatchlist = useLocalWatchlistItems();
	const localFavorites = useLocalFavorites();
	const localWatched = useLocalWatched();

	const [account, setAccount] = useState<SessionUser | null>(user);
	const {
		ids: watchIds,
		flip: flipWatch,
		replace: replaceWatch,
	} = useIdSet(initialWatchlistIds);
	const {
		ids: favIds,
		flip: flipFav,
		replace: replaceFav,
	} = useIdSet(initialFavoriteIds);
	const {
		ids: watchedIds,
		flip: flipWatched,
		replace: replaceWatched,
	} = useIdSet(initialWatchedIds);

	const hydrateAccount = useCallback(
		(input: {
			user: SessionUser | null;
			watchlistIds: string[];
			favoriteIds: string[];
			watchedIds: string[];
		}) => {
			setAccount(input.user);
			replaceWatch(input.watchlistIds);
			replaceFav(input.favoriteIds);
			replaceWatched(input.watchedIds);
		},
		[replaceFav, replaceWatch, replaceWatched],
	);

	const value = useMemo<LibraryContextValue>(() => {
		if (account) {
			return {
				user: account,
				isReady: true,
				hydrateAccount,
				watchlistHas: (mediaType, id) => watchIds.has(`${mediaType}-${id}`),
				favoriteHas: (mediaType, id) => favIds.has(`${mediaType}-${id}`),
				watchedHas: (mediaType, id) => watchedIds.has(`${mediaType}-${id}`),
				watchlistCount: watchIds.size,
				favoriteCount: favIds.size,
				watchedCount: watchedIds.size,
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
				toggleWatched: item => {
					const key = `${item.media_type}-${item.media_id}`;
					flipWatched(key);
					void toggleWatchedAction(item)
						.then(result => {
							if (result.error) flipWatched(key);
						})
						.catch(error => {
							console.error("[library] watched update failed", error);
							flipWatched(key);
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
			hydrateAccount,
			watchlistHas: (mediaType, id) =>
				guestWatchIds.has(`${mediaType}-${id}`),
			favoriteHas: (mediaType, id) =>
				localFavorites.ids.has(`${mediaType}-${id}`),
			watchedHas: (mediaType, id) =>
				localWatched.ids.has(`${mediaType}-${id}`),
			watchlistCount: localWatchlist.length,
			favoriteCount: localFavorites.ids.size,
			watchedCount: localWatched.ids.size,
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
			toggleWatched: localWatched.toggle,
		};
	}, [
		account,
		favIds,
		flipFav,
		flipWatch,
		flipWatched,
		hydrateAccount,
		localFavorites,
		localWatchlist,
		localWatched,
		watchIds,
		watchedIds,
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
