import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";

import MovieGrid from "@/components/movie-grid";
import { getCurrentUser } from "@/lib/auth";
import { getFavorites } from "@/lib/db";
import type { MovieType } from "@/types/global";

export const metadata: Metadata = { title: "Favorites" };

export default async function FavoritesPage() {
	const user = await getCurrentUser();

	if (!user) {
		return (
			<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-8 text-center">
				<span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<Heart className="size-6" />
				</span>
				<div>
					<h1 className="text-lg font-bold">Your favorites</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Log in to bookmark the movies and shows you love.
					</p>
				</div>
				<Link
					href="/login"
					className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">
					Log in
				</Link>
			</div>
		);
	}

	const movies: MovieType[] = getFavorites(user.id).map(item => ({
		id: item.media_id,
		media_type: item.media_type as MovieType["media_type"],
		title: item.title,
		poster_path: item.poster_path,
		backdrop_path: null,
		release_date: item.release_date,
		vote_average: item.vote_average,
		overview: "",
	}));

	return (
		<div className="space-y-6">
			<div>
				<h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight sm:text-2xl">
					<span className="flex size-8 items-center justify-center rounded-lg bg-amber-400/15 text-amber-400">
						<Heart className="size-4.5" />
					</span>
					Favorites
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					{movies.length} bookmarked {movies.length === 1 ? "title" : "titles"}
				</p>
			</div>

			<MovieGrid movies={movies} />
		</div>
	);
}
