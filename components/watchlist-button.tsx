"use client";

import Link from "next/link";
import { Heart, Bookmark } from "lucide-react";

import { useLibrary, type LibraryItem } from "@/components/library-provider";
import type { MovieType } from "@/types/global";
import { cn } from "@/lib/utils";

const baseStyles =
	"flex size-8 items-center justify-center rounded-full backdrop-blur-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function toLibraryItem(movie: MovieType): LibraryItem {
	return {
		media_type: movie.media_type ?? "movie",
		media_id: movie.id,
		title: movie.title,
		poster_path: movie.poster_path,
		release_date: movie.release_date,
		vote_average: movie.vote_average,
	};
}

export function WatchlistHeart({
	movie,
	variant = "overlay",
}: {
	movie: MovieType;
	variant?: "overlay" | "inline";
}) {
	const { watchlistHas, toggleWatchlist, isReady } = useLibrary();
	const saved = isReady && watchlistHas(movie.media_type ?? "movie", movie.id);

	return (
		<button
			type="button"
			aria-label={saved ? "Remove from watchlist" : "Add to watchlist"}
			aria-pressed={saved}
			onClick={e => {
				e.preventDefault();
				e.stopPropagation();
				toggleWatchlist(toLibraryItem(movie));
			}}
			className={cn(
				baseStyles,
				variant === "overlay"
					? saved
						? "bg-primary text-primary-foreground"
						: "bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 max-lg:opacity-100"
					: saved
						? "bg-primary/15 text-primary"
						: "bg-muted text-muted-foreground hover:text-foreground",
			)}>
			<Heart className={cn("size-4", saved && "fill-current")} />
		</button>
	);
}

export function FavoriteButton({
	movie,
	size = "default",
}: {
	movie: MovieType;
	size?: "default" | "large";
}) {
	const { favoriteHas, toggleFavorite, isReady, user } = useLibrary();
	const saved = isReady && favoriteHas(movie.media_type ?? "movie", movie.id);

	return (
		<button
			type="button"
			aria-label={saved ? "Remove bookmark" : "Bookmark this title"}
			aria-pressed={saved}
			title={
				!user
					? "Bookmarks save on this device — log in to sync"
					: saved
						? "Remove bookmark"
						: "Bookmark this title"
			}
			onClick={() => toggleFavorite(toLibraryItem(movie))}
			className={cn(
				baseStyles,
				size === "large" && "size-10",
				saved
					? "bg-amber-400/20 text-amber-400"
					: "bg-muted text-muted-foreground hover:text-foreground",
			)}>
			<Bookmark className={cn("size-4", size === "large" && "size-5", saved && "fill-current")} />
		</button>
	);
}

export function WatchlistLink() {
	const { watchlistCount, isReady } = useLibrary();
	const count = isReady ? watchlistCount : 0;

	return (
		<Link
			href="/watchlist"
			className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			aria-label={`Watchlist (${count} items)`}>
			<Bookmark className="size-4.5" />
			{count > 0 && (
				<span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
					{count > 99 ? "99+" : count}
				</span>
			)}
		</Link>
	);
}
