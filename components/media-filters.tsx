"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { GenreType } from "@/types/global";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
	{ value: "popularity.desc", label: "Most popular" },
	{ value: "vote_average.desc", label: "Highest rated" },
	{ value: "primary_release_date.desc", label: "Newest" },
	{ value: "primary_release_date.asc", label: "Oldest" },
	{ value: "revenue.desc", label: "Box office" },
];

const selectStyles =
	"h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

export default function MediaFilters({
	genres,
	mode,
}: {
	genres: GenreType[];
	mode: "genre" | "discover";
}) {
	const router = useRouter();
	const searchParams = useSearchParams();

	const currentYear = new Date().getFullYear();
	const [sortBy, setSortBy] = useState(searchParams.get("sort") ?? "popularity.desc");
	const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? "");
	const [dateTo, setDateTo] = useState(searchParams.get("to") ?? "");
	const [selectedGenres, setSelectedGenres] = useState<string[]>(
		searchParams.get("genres")?.split(",").filter(Boolean) ?? [],
	);
	const [minVote, setMinVote] = useState(searchParams.get("vote") ?? "");
	const [maxRuntime, setMaxRuntime] = useState(searchParams.get("runtime") ?? "");

	function apply() {
		const params = new URLSearchParams();
		if (sortBy && sortBy !== "popularity.desc") params.set("sort", sortBy);
		if (dateFrom) params.set("from", dateFrom);
		if (dateTo) params.set("to", dateTo);
		if (mode === "discover") {
			if (selectedGenres.length) params.set("genres", selectedGenres.join(","));
			if (minVote) params.set("vote", minVote);
			if (maxRuntime) params.set("runtime", maxRuntime);
		}
		router.push(
			`${window.location.pathname}${params.size ? `?${params}` : ""}`,
		);
	}

	function reset() {
		setSortBy("popularity.desc");
		setDateFrom("");
		setDateTo("");
		setSelectedGenres([]);
		setMinVote("");
		setMaxRuntime("");
		router.push(window.location.pathname);
	}

	return (
		<div className="rounded-2xl border border-border/60 bg-card/50 p-4">
			<div className="flex items-center gap-2 text-sm font-semibold">
				<SlidersHorizontal className="size-4 text-primary" />
				Filters
			</div>

			<div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
				<label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
					Sort by
					<select
						value={sortBy}
						onChange={e => setSortBy(e.target.value)}
						className={selectStyles}>
						{SORT_OPTIONS.map(opt => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</label>

				<label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
					From year
					<input
						type="number"
						min={1900}
						max={currentYear}
						placeholder="1900"
						value={dateFrom}
						onChange={e => setDateFrom(e.target.value)}
						className={cn(selectStyles, "w-24 placeholder:text-muted-foreground/60")}
					/>
				</label>

				<label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
					To year
					<input
						type="number"
						min={1900}
						max={currentYear + 5}
						placeholder={String(currentYear)}
						value={dateTo}
						onChange={e => setDateTo(e.target.value)}
						className={cn(selectStyles, "w-24 placeholder:text-muted-foreground/60")}
					/>
				</label>

				{mode === "discover" && (
					<>
						<label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
							Min rating
							<select
								value={minVote}
								onChange={e => setMinVote(e.target.value)}
								className={selectStyles}>
								<option value="">Any</option>
								{[5, 6, 7, 8, 9].map(v => (
									<option key={v} value={v}>
										{v}+
									</option>
								))}
							</select>
						</label>

						<label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
							Max runtime
							<select
								value={maxRuntime}
								onChange={e => setMaxRuntime(e.target.value)}
								className={selectStyles}>
								<option value="">Any</option>
								{[90, 120, 150, 180].map(v => (
									<option key={v} value={v}>
										Under {v} min
									</option>
								))}
							</select>
						</label>

						<div className="flex w-full flex-col gap-2">
							<span className="text-xs font-medium text-muted-foreground">
								Genres
							</span>
							<div className="flex flex-wrap gap-2">
								{genres.map(genre => {
									const activeGenre = selectedGenres.includes(String(genre.id));
									return (
										<button
											key={genre.id}
											type="button"
											aria-pressed={activeGenre}
											onClick={() =>
												setSelectedGenres(prev =>
													activeGenre
														? prev.filter(id => id !== String(genre.id))
														: [...prev, String(genre.id)],
												)
											}
											className={cn(
												"rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
												activeGenre
													? "border-primary bg-primary text-primary-foreground"
													: "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
											)}>
											{genre.name}
										</button>
									);
								})}
							</div>
						</div>
					</>
				)}

				<div className="flex gap-2 sm:ml-auto">
					<Button type="button" size="sm" onClick={apply}>
						Apply
					</Button>
					<button
						type="button"
						onClick={reset}
						className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
						Reset
					</button>
				</div>
			</div>
		</div>
	);
}
