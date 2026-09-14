import Image from "next/image";
import Link from "next/link";
import { Film, Star } from "lucide-react";

import { WatchlistHeart, WatchedButton } from "@/components/watchlist-button";
import { imageUrl, year } from "@/lib/tmdb";
import type { MovieType } from "@/types/global";
import { cn } from "@/lib/utils";

export default function MovieCard({
	movie,
	className,
	meta,
}: {
	movie: MovieType;
	className?: string;
	/** Optional line shown instead of the year (e.g. full release dates) */
	meta?: string;
}) {
	const poster = imageUrl(movie.poster_path, "w342");
	const href = movie.media_type === "tv" ? `/tv/${movie.id}` : `/detail/${movie.id}`;

	return (
		<div className={cn("group relative", className)}>
			<Link
				href={href}
				className="block focus-visible:outline-none">
				<div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-md ring-1 ring-white/5 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-black/40 group-hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring">
					{poster ? (
						<Image
							src={poster}
							alt={movie.title}
							fill
							sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
							className="object-cover transition-transform duration-300 group-hover:scale-105"
						/>
					) : (
						<div className="flex h-full items-center justify-center text-muted-foreground">
							<Film className="size-10" />
						</div>
					)}
					{movie.vote_average > 0 && (
						<span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-amber-400 backdrop-blur-sm">
							<Star className="size-3 fill-amber-400" />
							{movie.vote_average.toFixed(1)}
						</span>
					)}
				</div>
			</Link>

			<div className="absolute left-2 top-2 z-10 flex gap-1.5 transition-opacity">
				<WatchlistHeart movie={movie} />
				<WatchedButton movie={movie} variant="overlay" />
			</div>

			<div className="mt-2 px-0.5">
				<Link href={href}>
					<p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
						{movie.title}
					</p>
				</Link>
				<p className="truncate text-xs text-muted-foreground">
					{meta ?? year(movie.release_date)}
					{!meta && movie.media_type === "tv" && " · TV"}
				</p>
			</div>
		</div>
	);
}
