import type { Metadata } from "next";
import { Bookmark } from "lucide-react";

import MovieGrid from "@/components/movie-grid";
import WatchlistContent from "@/components/watchlist-content";
import { getCurrentUser } from "@/lib/auth";
import { getWatchlist } from "@/lib/db";
import type { MovieType } from "@/types/global";

export const metadata: Metadata = { title: "My Watchlist" };

export default async function WatchlistPage() {
	const user = await getCurrentUser();

	let dbMovies: MovieType[] = [];
	if (user) {
		dbMovies = (await getWatchlist(user.id)).map(item => ({
			id: item.media_id,
			media_type: item.media_type as MovieType["media_type"],
			title: item.title,
			poster_path: item.poster_path,
			backdrop_path: null,
			release_date: item.release_date,
			vote_average: item.vote_average,
			overview: "",
		}));
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight sm:text-2xl">
					<span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
						<Bookmark className="size-4.5" />
					</span>
					My Watchlist
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					{user
						? "Synced to your account across devices."
						: "Saved on this device — log in to sync it everywhere."}
				</p>
			</div>

			{user ? <MovieGrid movies={dbMovies} /> : <WatchlistContent />}
		</div>
	);
}
