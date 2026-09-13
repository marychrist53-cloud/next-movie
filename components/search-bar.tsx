"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { imageUrl } from "@/lib/tmdb";

type SuggestItem = {
	id: number;
	media_type: string;
	title: string;
	poster_path: string | null;
	release_date: string | null;
};

export default function SearchBar() {
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [items, setItems] = useState<SuggestItem[]>([]);
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	const boxRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function onClick(e: MouseEvent) {
			if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
		}
		document.addEventListener("mousedown", onClick);
		return () => document.removeEventListener("mousedown", onClick);
	}, []);

	useEffect(() => {
		const q = query.trim();
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			if (q.length < 2) {
				setItems([]);
				setOpen(false);
				return;
			}
			try {
				const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, {
					signal: controller.signal,
				});
				if (res.ok) {
					const data = (await res.json()) as { results: SuggestItem[] };
					setItems(data.results ?? []);
					setOpen(true);
					setActive(-1);
				}
			} catch (error) {
				if (!(error instanceof DOMException && error.name === "AbortError")) {
					console.error("[search] suggestions failed", error);
					setOpen(false);
				}
			}
		}, 250);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [query]);

	function submit() {
		const q = query.trim();
		if (!q) return;
		if (active >= 0 && items[active]) {
			const item = items[active];
			router.push(item.media_type === "tv" ? `/tv/${item.id}` : `/detail/${item.id}`);
		} else {
			router.push(`/search?q=${encodeURIComponent(q)}`);
		}
		setOpen(false);
	}

	function onKeyDown(e: React.KeyboardEvent) {
		if (!open || !items.length) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActive(prev => (prev + 1) % items.length);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActive(prev => (prev <= 0 ? items.length - 1 : prev - 1));
		} else if (e.key === "Escape") {
			setOpen(false);
		}
	}

	return (
		<div ref={boxRef} className="relative order-3 w-full min-w-0 flex-1 sm:order-none sm:w-72 md:w-80 lg:flex-none">
			<form
				action={() => submit()}
				className="flex items-center gap-2">
				<Input
					name="q"
					value={query}
					onChange={e => setQuery(e.target.value)}
					onKeyDown={onKeyDown}
					onFocus={() => items.length && setOpen(true)}
					placeholder="Search movies & shows..."
					aria-label="Search movies and TV shows"
					role="combobox"
					aria-autocomplete="list"
					aria-haspopup="listbox"
					aria-expanded={open && items.length > 0}
					aria-controls="search-suggestions"
					aria-activedescendant={
						active >= 0 ? `search-suggestion-${active}` : undefined
					}
					className="h-9 flex-1"
					autoComplete="off"
				/>
				<Button type="submit" aria-label="Search">
					<Search />
				</Button>
			</form>

			{open && items.length > 0 && (
				<div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl shadow-black/40 backdrop-blur-md">
					<ul
						id="search-suggestions"
						role="listbox"
						aria-label="Search suggestions">
						{items.map((item, index) => (
							<li key={`${item.media_type}-${item.id}`} role="none">
								<button
									id={`search-suggestion-${index}`}
									type="button"
									role="option"
									aria-selected={index === active}
									onMouseDown={e => e.preventDefault()}
									onClick={() => {
										router.push(
											item.media_type === "tv"
												? `/tv/${item.id}`
												: `/detail/${item.id}`,
										);
										setOpen(false);
									}}
									onMouseEnter={() => setActive(index)}
									className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
										index === active ? "bg-muted" : ""
									}`}>
									<div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
										{item.poster_path && (
											<SuggestPoster path={item.poster_path} title={item.title} />
										)}
									</div>
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">{item.title}</p>
										<p className="text-xs text-muted-foreground">
											{item.media_type === "tv" ? "TV" : "Movie"}
											{item.release_date ? ` · ${item.release_date.slice(0, 4)}` : ""}
										</p>
									</div>
								</button>
							</li>
						))}
					</ul>
					<button
						type="button"
						onClick={submit}
						className="w-full border-t border-border/60 px-3 py-2 text-center text-xs font-medium text-primary transition-colors hover:bg-muted">
						See all results for “{query.trim()}”
					</button>
				</div>
			)}
		</div>
	);
}

function SuggestPoster({ path, title }: { path: string; title: string }) {
	const url = imageUrl(path, "w92");
	if (!url) return null;
	return (
		<Image
			src={url}
			alt={title}
			fill
			sizes="40px"
			className="object-cover"
		/>
	);
}
