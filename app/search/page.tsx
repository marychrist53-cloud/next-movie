import type { Metadata } from "next";
import { SearchX } from "lucide-react";

import MovieGrid from "@/components/movie-grid";
import Pagination from "@/components/pagination";
import { fetchSearchMulti } from "@/lib/tmdb";

export const metadata: Metadata = { title: "Search" };

type Props = {
	searchParams: Promise<{ q?: string; page?: string }>;
};

export default async function Search({ searchParams }: Props) {
	const { q, page: pageParam } = await searchParams;
	const query = (q ?? "").trim();
	const page = Math.max(1, Math.min(Number(pageParam) || 1, 500));

	let data;
	if (query) {
		try {
			data = await fetchSearchMulti(query, page);
		} catch (error) {
			console.error("[search] failed to load results", error);
			data = undefined;
		}
	}

	return (
		<div className="space-y-6">
			<h1 className="text-xl font-bold tracking-tight sm:text-2xl">
				{query ? (
					<>
						Results for{" "}
						<span className="text-primary">“{query}”</span>
						{data && (
							<span className="ml-2 text-sm font-normal text-muted-foreground">
								{data.total_results.toLocaleString()} found
							</span>
						)}
					</>
				) : (
					"Search"
				)}
			</h1>

			{!query ? (
				<div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
					<SearchX className="size-8 opacity-50" />
					<p>Type something in the search bar to find movies and shows.</p>
				</div>
			) : !data ? (
				<div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
					<SearchX className="size-8 opacity-50" />
					<p>Something went wrong. Please try again.</p>
				</div>
			) : (
				<>
					<MovieGrid movies={data.results} />
					<Pagination
						page={data.page}
						totalPages={data.total_pages}
						basePath="/search"
						query={{ q: query }}
					/>
				</>
			)}
		</div>
	);
}
