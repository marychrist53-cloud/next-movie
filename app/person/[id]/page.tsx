import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { User } from "lucide-react";

import SectionHeading from "@/components/section-heading";
import MovieGrid from "@/components/movie-grid";
import {
	creditToCardItem,
	fetchPerson,
	fetchPersonCredits,
	imageUrl,
} from "@/lib/tmdb";
import type { CreditType } from "@/types/global";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { id } = await params;
	try {
		const person = await fetchPerson(id);
		const photo = imageUrl(person.profile_path, "w342");
		return {
			title: person.name,
			description:
				person.biography?.slice(0, 160) ||
				`Explore ${person.name}'s filmography on Next Movie.`,
			openGraph: {
				title: person.name,
				images: photo ? [{ url: photo }] : [],
				type: "profile",
			},
			alternates: { canonical: `/person/${id}` },
		};
	} catch {
		return { title: "Person" };
	}
}

const MAX_PER_GROUP = 12;

function latestDate(credit: CreditType): string {
	return credit.release_date ?? credit.first_air_date ?? "";
}

export default async function PersonPage({ params }: Props) {
	const { id } = await params;

	let person: Awaited<ReturnType<typeof fetchPerson>>;
	let credits: Awaited<ReturnType<typeof fetchPersonCredits>> = {
		cast: [],
		crew: [],
	};
	try {
		person = await fetchPerson(id);
	} catch {
		notFound();
	}
	try {
		credits = await fetchPersonCredits(id);
	} catch (error) {
		console.error(`[person] failed to load credits for ${id}`, error);
	}

	const profile = imageUrl(person.profile_path, "w342");
	const lifeDates = [person.birthday, person.deathday].filter(
		Boolean,
	) as string[];

	// Group filmography by department: acting credits + crew jobs
	const groups = new Map<string, CreditType[]>();

	function addToGroup(department: string, credit: CreditType) {
		if (!credit.poster_path) return;
		const list = groups.get(department) ?? [];
		list.push(credit);
		groups.set(department, list);
	}

	for (const credit of credits.cast ?? []) {
		addToGroup("Acting", credit);
	}
	for (const credit of credits.crew ?? []) {
		addToGroup(credit.department || "Crew", credit);
	}

	const filmography = [...groups.entries()]
		.map(([department, items]) => {
			// TMDB movie and TV IDs can overlap, so include the media type.
			const seen = new Set<string>();
			const unique = items.filter(credit => {
				const key = `${credit.media_type === "tv" ? "tv" : "movie"}-${credit.id}`;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
			unique.sort((a, b) =>
				latestDate(b).localeCompare(latestDate(a)),
			);

			return {
				department,
				movies: unique.slice(0, MAX_PER_GROUP).map(creditToCardItem),
				total: unique.length,
			};
		})
		.sort((a, b) => b.total - a.total);

	return (
		<div className="space-y-10">
			<section className="flex flex-col gap-6 sm:flex-row sm:items-start">
				<div className="relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl bg-muted shadow-xl ring-1 ring-white/10 sm:w-48">
					{profile ? (
						<Image
							src={profile}
							alt={person.name}
							fill
							priority
							sizes="(max-width: 640px) 160px, 192px"
							className="object-cover"
						/>
					) : (
						<div className="flex h-full items-center justify-center text-muted-foreground">
							<User className="size-10" />
						</div>
					)}
				</div>

				<div className="min-w-0 pt-2 sm:pt-0">
					<h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
						{person.name}
					</h1>
					{person.known_for_department && (
						<p className="mt-1.5 text-sm font-medium uppercase tracking-wider text-primary">
							{person.known_for_department}
						</p>
					)}
					<div className="mt-3 space-y-1 text-sm text-muted-foreground">
						{lifeDates.length > 0 && (
							<p>
								{lifeDates[0]}
								{lifeDates[1] ? ` – ${lifeDates[1]}` : ""}
							</p>
						)}
						{person.place_of_birth && <p>{person.place_of_birth}</p>}
					</div>
					{person.biography && (
						<p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
							{person.biography}
						</p>
					)}
				</div>
			</section>

			{filmography.map(group => (
				<section key={group.department}>
					<SectionHeading
						title={group.department}
						badge={`${group.total} credits`}
					/>
					<MovieGrid movies={group.movies} className="mt-5" />
				</section>
			))}
		</div>
	);
}
