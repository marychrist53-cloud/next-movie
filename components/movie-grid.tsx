import { Clapperboard } from "lucide-react";

import MovieCard from "@/components/movie-card";
import { cn } from "@/lib/utils";
import type { MovieType } from "@/types/global";

export default function MovieGrid({
	movies,
	className,
	metaFor,
}: {
	movies: MovieType[];
	className?: string;
	/** Optional per-movie subtitle line (e.g. full release dates) */
	metaFor?: (movie: MovieType) => string | undefined;
}) {
	if (!movies.length) {
		return (
			<div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
				<Clapperboard className="size-8 opacity-50" />
				<p>No movies found.</p>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5",
				className,
			)}>
			{movies.map(movie => (
				<MovieCard
					key={`${movie.media_type ?? "movie"}-${movie.id}`}
					movie={movie}
					meta={metaFor?.(movie)}
				/>
			))}
		</div>
	);
}
