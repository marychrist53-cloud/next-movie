"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { useSyncExternalStore } from "react";

import { setRatingAction } from "@/app/actions/library";
import { useLibrary } from "@/components/library-provider";
import type { MediaType } from "@/types/global";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "nm-ratings";
const CHANGE_EVENT = "nm-ratings-changed";

function subscribe(callback: () => void) {
	window.addEventListener("storage", callback);
	window.addEventListener(CHANGE_EVENT, callback);
	return () => {
		window.removeEventListener("storage", callback);
		window.removeEventListener(CHANGE_EVENT, callback);
	};
}

function getServerSnapshot(): number | null {
	return null;
}

function parseRatings(raw: string | null): Record<string, number> {
	if (!raw) return {};
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

		const ratings: Record<string, number> = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (
				/^(movie|tv)-\d+$/.test(key) &&
				Number.isInteger(value) &&
				(value as number) >= 1 &&
				(value as number) <= 10
			) {
				ratings[key] = value as number;
			}
		}
		return ratings;
	} catch {
		return {};
	}
}

function readLocalRating(key: string): number | null {
	let raw: string | null = null;
	try {
		raw = localStorage.getItem(STORAGE_KEY);
	} catch {}
	return parseRatings(raw)[key] ?? null;
}

export default function RatingStars({
	mediaType,
	id,
	initialRating = null,
}: {
	mediaType: MediaType;
	id: number;
	initialRating?: number | null;
}) {
	const { user } = useLibrary();
	const key = `${mediaType}-${id}`;

	const localRating = useSyncExternalStore(
		subscribe,
		() => readLocalRating(key),
		getServerSnapshot,
	);

	const [serverRating, setServerRating] = useState<number | null>(initialRating);
	const rating = user ? serverRating : localRating;

	function save(value: number) {
		if (user) {
			const previous = serverRating;
			const next = serverRating === value ? null : value;
			setServerRating(next);
			void setRatingAction(mediaType, id, next)
				.then(result => {
					if (result.error) setServerRating(previous);
				})
				.catch(error => {
					console.error("[rating] update failed", error);
					setServerRating(previous);
				});
			return;
		}

		let ratings: Record<string, number> = {};
		try {
			ratings = parseRatings(localStorage.getItem(STORAGE_KEY));
		} catch {}

		if (ratings[key] === value) {
			delete ratings[key];
		} else {
			ratings[key] = value;
		}

		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
		} catch {}
		window.dispatchEvent(new Event(CHANGE_EVENT));
	}

	const display = rating ?? 0;
	const label = user
		? rating
			? `Your rating: ${rating}/10 — tap again to clear`
			: "Rate this title"
		: rating
			? `Your rating: ${rating}/10`
			: "Rate this title";

	return (
		<div className="flex items-center gap-3">
			<div className="flex gap-0.5" role="group" aria-label="Rate this title">
				{[1, 2, 3, 4, 5].map(star => {
					const value = star * 2;
					const active = display >= value;

					return (
						<button
							key={star}
							type="button"
							aria-pressed={rating === value}
							aria-label={`${value} out of 10`}
							onClick={() => save(value)}
							className={cn(
								"rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								active
									? "text-amber-400"
									: "text-muted-foreground/50 hover:text-amber-400/70",
							)}>
							<Star
								className={cn(
									"size-5 transition-transform hover:scale-110",
									active && "fill-current",
								)}
							/>
						</button>
					);
				})}
			</div>
			<span className="text-sm text-muted-foreground" aria-live="polite">
				{label}
			</span>
		</div>
	);
}
