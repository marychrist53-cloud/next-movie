"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { EyeOff } from "lucide-react";

import MovieCard from "@/components/movie-card";
import { isValidLibraryItem } from "@/lib/library-validation";
import type { MovieType } from "@/types/global";

const EMPTY: MovieType[] = [];

function subscribe(callback: () => void) {
	window.addEventListener("storage", callback);
	window.addEventListener("nm-watched-changed", callback);
	return () => {
		window.removeEventListener("storage", callback);
		window.removeEventListener("nm-watched-changed", callback);
	};
}

export default function WatchedContent() {
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

	const movies = useMemo(() => {
		try {
			const parsed: unknown = JSON.parse(raw);
			if (!Array.isArray(parsed)) return EMPTY;
			return parsed.filter(isValidLibraryItem).map(item => ({
				id: item.media_id,
				media_type: item.media_type,
				title: item.title,
				poster_path: item.poster_path,
				backdrop_path: null,
				release_date: item.release_date,
				vote_average: item.vote_average,
				overview: "",
			}));
		} catch {
			return EMPTY;
		}
	}, [raw]);

	if (!movies.length) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed py-16 text-center">
				<span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<EyeOff className="size-6" />
				</span>
				<div>
					<h2 className="text-lg font-bold">Nothing watched yet</h2>
					<p className="mt-1 max-w-sm text-sm text-muted-foreground">
						Mark titles as watched from a detail page or poster overlay.
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
			{movies.map(movie => (
				<MovieCard key={`${movie.media_type}-${movie.id}`} movie={movie} />
			))}
		</div>
	);
}
