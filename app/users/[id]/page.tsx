import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";

import MovieGrid from "@/components/movie-grid";
import {
	countRatingsForUser,
	getFavorites,
	getUserProfile,
	getWatchlist,
	getWatched,
} from "@/lib/db";
import type { MovieType } from "@/types/global";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { id } = await params;
	const profile = await getUserProfile(Number(id));
	if (!profile) return { title: "Profile" };
	return {
		title: `${profile.name} — Profile`,
		description:
			profile.bio ||
			`${profile.name}'s watchlist, favorites and ratings on Next Movie.`,
	};
}

export default async function UserProfilePage({ params }: Props) {
	const { id } = await params;
	const userId = Number(id);
	if (!Number.isInteger(userId) || userId <= 0) notFound();

	const profile = await getUserProfile(userId);
	if (!profile) notFound();

	const toMovie = (item: {
		media_id: number;
		media_type: string;
		title: string;
		poster_path: string | null;
		release_date: string | null;
		vote_average: number;
	}): MovieType => ({
		id: item.media_id,
		media_type: item.media_type as MovieType["media_type"],
		title: item.title,
		poster_path: item.poster_path,
		backdrop_path: null,
		release_date: item.release_date,
		vote_average: item.vote_average,
		overview: "",
	});

	const watchlist = (await getWatchlist(userId)).map(toMovie);
	const favorites = (await getFavorites(userId)).map(toMovie);
	const watched = (await getWatched(userId)).map(toMovie);
	const ratingsCount = await countRatingsForUser(userId);

	return (
		<div className="space-y-10">
			<section className="flex flex-col gap-5 rounded-2xl border border-border/60 p-6 sm:flex-row sm:items-center">
				<span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary/15 text-3xl font-extrabold text-primary">
					{profile.name.charAt(0).toUpperCase()}
				</span>
				<div className="min-w-0">
					<h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
						{profile.name}
					</h1>
					{profile.bio && (
						<p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
							{profile.bio}
						</p>
					)}
					<p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
						<CalendarDays className="size-3.5" />
						Joined{" "}
						{new Date(profile.created_at + "Z").toLocaleDateString("en-US", {
							month: "long",
							year: "numeric",
						})}
					</p>
				</div>
				<div className="flex gap-6 sm:ml-auto">
					<div className="text-center">
						<p className="text-2xl font-extrabold">{watchlist.length}</p>
						<p className="text-xs text-muted-foreground">Watchlist</p>
					</div>
					<div className="text-center">
						<p className="text-2xl font-extrabold">{favorites.length}</p>
						<p className="text-xs text-muted-foreground">Favorites</p>
					</div>
					<div className="text-center">
						<p className="text-2xl font-extrabold">{watched.length}</p>
						<p className="text-xs text-muted-foreground">Watched</p>
					</div>
					<div className="text-center">
						<p className="text-2xl font-extrabold">{ratingsCount}</p>
						<p className="text-xs text-muted-foreground">Rated</p>
					</div>
				</div>
			</section>

			<section>
				<h2 className="text-xl font-bold tracking-tight">Watchlist</h2>
				<MovieGrid movies={watchlist} className="mt-5" />
			</section>

			{favorites.length > 0 && (
				<section>
					<h2 className="text-xl font-bold tracking-tight">Favorites</h2>
					<MovieGrid movies={favorites} className="mt-5" />
				</section>
			)}

			{watched.length > 0 && (
				<section>
					<h2 className="text-xl font-bold tracking-tight">Watched</h2>
					<MovieGrid movies={watched} className="mt-5" />
				</section>
			)}
		</div>
	);
}
