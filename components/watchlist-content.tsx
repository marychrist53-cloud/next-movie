"use client";

import Link from "next/link";
import { BookmarkX } from "lucide-react";

import MovieCard from "@/components/movie-card";
import {
	useWatchlistItems,
	type WatchlistItem,
} from "@/components/watchlist-store";
import type { MovieType } from "@/types/global";

export default function WatchlistContent() {
	const items = useWatchlistItems();

	if (!items.length) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed py-16 text-center">
				<span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<BookmarkX className="size-6" />
				</span>
				<div>
					<h2 className="text-lg font-bold">Your watchlist is empty</h2>
					<p className="mt-1 max-w-sm text-sm text-muted-foreground">
						Tap the heart on any poster to save it here for later.
					</p>
				</div>
				<Link
					href="/"
					className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">
					Browse movies
				</Link>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
			{items.map(item => (
				<MovieCard
					key={watchlistItemKey(item)}
					movie={toCardMovie(item)}
				/>
			))}
		</div>
	);
}

function watchlistItemKey(item: WatchlistItem) {
	return `${item.media_type}-${item.id}`;
}

function toCardMovie(item: WatchlistItem): MovieType {
	return {
		id: item.id,
		media_type: item.media_type,
		title: item.title,
		poster_path: item.poster_path,
		backdrop_path: null,
		release_date: item.release_date,
		vote_average: item.vote_average,
		overview: "",
	};
}
