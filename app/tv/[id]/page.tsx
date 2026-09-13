import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Star, Tv, User } from "lucide-react";

import MovieGrid from "@/components/movie-grid";
import CommentSection from "@/components/comment-section";
import JsonLd from "@/components/json-ld";
import { FavoriteButton } from "@/components/watchlist-button";
import NotifyButton from "@/components/notify-button";
import RatingStars from "@/components/rating-stars";
import TrailerButton from "@/components/trailer-button";
import VideoGrid from "@/components/video-grid";
import SectionHeading from "@/components/section-heading";
import {
	fetchCast,
	fetchSimilar,
	fetchTv,
	fetchVideos,
	imageUrl,
	year,
} from "@/lib/tmdb";
import { getCurrentUser } from "@/lib/auth";
import { getRating, isSubscribed } from "@/lib/db";
import type {
	CastMemberType,
	MovieType,
	TvDetailType,
	VideoType,
} from "@/types/global";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { id } = await params;
	try {
		const show = await fetchTv(id);
		const poster = imageUrl(show.poster_path, "w780");
		return {
			title: show.name,
			description:
				show.overview?.slice(0, 160) || `Discover ${show.name} on Next Movie.`,
			openGraph: {
				title: show.name,
				description: show.overview?.slice(0, 200),
				images: poster ? [{ url: poster, width: 780, height: 1170 }] : [],
				type: "video.tv_show",
			},
			twitter: {
				card: poster ? "summary_large_image" : "summary",
				title: show.name,
				description: show.overview?.slice(0, 200),
				images: poster ? [poster] : [],
			},
			alternates: { canonical: `/tv/${id}` },
		};
	} catch {
		return { title: "TV Show" };
	}
}

function formatFullDate(date: string): string {
	return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
}

export default async function TvDetail({ params }: Props) {
	const { id } = await params;

	let show: TvDetailType;
	let cast: CastMemberType[] = [];
	let videos: VideoType[] = [];
	let similar: MovieType[] = [];
	try {
		show = await fetchTv(id);
	} catch {
		notFound();
	}

	const [castResult, videosResult, similarResult] = await Promise.allSettled([
			fetchCast("tv", id),
			fetchVideos("tv", id),
			fetchSimilar("tv", id),
		]);
	if (castResult.status === "fulfilled") cast = castResult.value;
	else console.error(`[tv] failed to load cast for ${id}`, castResult.reason);
	if (videosResult.status === "fulfilled") videos = videosResult.value;
	else console.error(`[tv] failed to load videos for ${id}`, videosResult.reason);
	if (similarResult.status === "fulfilled") similar = similarResult.value;
	else console.error(`[tv] failed to load similar shows for ${id}`, similarResult.reason);

	const backdrop = imageUrl(show.backdrop_path, "w1280");
	const poster = imageUrl(show.poster_path, "w500");
	const trailer = videos[0] ?? null;
	const runtime = show.episode_run_time?.[0];
	const seasons = (show.seasons ?? []).filter(
		s => s.season_number > 0 && s.episode_count > 0,
	);

	const user = await getCurrentUser();
	const userRating = user ? getRating(user.id, "tv", show.id) : null;
	const subscribed = user ? isSubscribed(user.id, "tv", show.id) : false;

	const nextEp = show.next_episode_to_air;
	const lastEp = show.last_episode_to_air;
	const currentSeason = nextEp
		? seasons.find(s => s.season_number === nextEp.season_number)
		: seasons.at(-1);
	const isOngoing = show.status === "Returning Series" || !!nextEp;

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "TVSeries",
		name: show.name,
		description: show.overview,
		image: imageUrl(show.poster_path, "w780") ?? undefined,
		datePublished: show.first_air_date ?? undefined,
		numberOfSeasons: show.number_of_seasons,
		url: `/tv/${show.id}`,
		...(show.vote_average > 0 && {
			aggregateRating: {
				"@type": "AggregateRating",
				ratingValue: show.vote_average.toFixed(1),
				bestRating: 10,
				ratingCount: show.vote_count ?? 0,
			},
		}),
	};

	return (
		<div className="space-y-10">
			<JsonLd data={jsonLd} />
			<section className="relative -mx-4 -mt-4 sm:-mx-6 sm:-mt-5 lg:-mx-8 lg:-mt-8">
				<div className="relative h-64 w-full sm:h-80 lg:h-[26rem]">
					{backdrop ? (
						<Image
							src={backdrop}
							alt=""
							fill
							priority
							sizes="(min-width: 1440px) 1136px, (min-width: 1024px) calc(100vw - 304px), (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
							className="object-cover"
						/>
					) : (
						<div className="flex h-full items-center justify-center bg-muted text-muted-foreground">
							<Tv className="size-12" />
						</div>
					)}
					<div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
				</div>
			</section>

			<section className="-mt-16 flex flex-col gap-6 sm:flex-row sm:items-end lg:-mt-24">
				{poster && (
					<div className="relative aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl shadow-2xl shadow-black/50 ring-1 ring-white/10 sm:w-44 lg:w-52">
						<Image
							src={poster}
							alt={show.name}
							fill
							sizes="(max-width: 640px) 144px, 208px"
							className="object-cover"
						/>
					</div>
				)}
				<div className="min-w-0 pb-2">
					<p className="text-xs font-semibold uppercase tracking-wider text-primary">
						TV Series
					</p>
					<h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
						{show.name}
					</h1>
					{show.tagline && (
						<p className="mt-1.5 text-sm italic text-muted-foreground">
							“{show.tagline}”
						</p>
					)}
					<div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
						{show.vote_average > 0 && (
							<span className="inline-flex items-center gap-1.5 font-semibold text-amber-400">
								<Star className="size-4 fill-amber-400" />
								{show.vote_average.toFixed(1)}
							</span>
						)}
						{show.first_air_date && (
							<span className="inline-flex items-center gap-1.5">
								<CalendarDays className="size-4" />
								{year(show.first_air_date)} · {show.number_of_seasons} seasons
							</span>
						)}
						{runtime && <span>{runtime} min / episode</span>}
					</div>
					{!!show.genres?.length && (
						<div className="mt-4 flex flex-wrap gap-2">
							{show.genres.map(genre => (
								<span
									key={genre.id}
									className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
									{genre.name}
								</span>
							))}
						</div>
					)}
					<div className="mt-5 flex flex-wrap items-center gap-4">
						{trailer && <TrailerButton videoKey={trailer.key} title={show.name} />}
						<RatingStars
							mediaType="tv"
							id={show.id}
							initialRating={userRating}
						/>
						<div className="flex items-center gap-2">
							<FavoriteButton movie={{ ...show, media_type: "tv", title: show.name, release_date: show.first_air_date }} size="large" />
							<NotifyButton
								mediaType="tv"
								mediaId={show.id}
								title={show.name}
								subscribed={subscribed}
							/>
						</div>
					</div>
				</div>
			</section>

			<section className="max-w-3xl">
				<h2 className="text-xl font-bold tracking-tight">Overview</h2>
				<p className="mt-3 leading-relaxed text-muted-foreground">
					{show.overview || "No overview available."}
				</p>
			</section>

			<section>
				<SectionHeading
					icon={<CalendarDays className="size-4.5" />}
					title={isOngoing ? "Schedule" : "Status"}
				/>
				<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
					{nextEp ? (
						<div className="rounded-xl border border-border/60 p-4">
							<p className="text-xs font-semibold uppercase tracking-wider text-primary">
								Next episode
							</p>
							<p className="mt-1 font-semibold">
								S{nextEp.season_number} E{nextEp.episode_number}
								{nextEp.name ? ` — ${nextEp.name}` : ""}
							</p>
							<p className="mt-0.5 text-sm text-muted-foreground">
								{nextEp.air_date
									? `Airs ${formatFullDate(nextEp.air_date)}`
									: "Air date TBA"}
							</p>
						</div>
					) : (
						<div className="rounded-xl border border-border/60 p-4">
							<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Status
							</p>
							<p className="mt-1 font-semibold">{show.status ?? "Unknown"}</p>
							{lastEp?.air_date && (
								<p className="mt-0.5 text-sm text-muted-foreground">
									Latest episode aired {formatFullDate(lastEp.air_date)}
								</p>
							)}
						</div>
					)}

					{currentSeason && (
						<div className="rounded-xl border border-border/60 p-4">
							<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Season {currentSeason.season_number}
							</p>
							<p className="mt-1 font-semibold">
								~{currentSeason.episode_count} episodes
							</p>
							<p className="mt-0.5 text-sm text-muted-foreground">
								{isOngoing
									? "Expected total for this season"
									: "Total episodes"}
							</p>
						</div>
					)}
				</div>
			</section>

			{!!videos.length && (
				<section>
					<SectionHeading title="Videos" />
					<div className="mt-5">
						<VideoGrid videos={videos} title={show.name} />
					</div>
				</section>
			)}

			{!!seasons.length && (
				<section>
					<SectionHeading title="Seasons" />
					<div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
						{seasons.map(season => (
							<div
								key={season.id}
								className="rounded-xl border border-border/60 p-4 transition-colors hover:border-primary/40">
								<div className="flex items-baseline justify-between gap-3">
									<h3 className="font-semibold">{season.name}</h3>
									<span className="shrink-0 text-xs text-muted-foreground">
										{season.episode_count} episodes
									</span>
								</div>
								{season.air_date && (
									<p className="mt-0.5 text-xs text-muted-foreground">
										Aired {year(season.air_date)}
									</p>
								)}
								{season.overview && (
									<p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
										{season.overview}
									</p>
								)}
							</div>
						))}
					</div>
				</section>
			)}

			<section>
				<h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
					<User className="size-5 text-primary" />
					Cast
				</h2>
				{cast.length ? (
					<div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
						{cast.slice(0, 24).map(person => (
							<Link
								key={person.id}
								href={`/person/${person.id}`}
								className="group rounded-xl text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
								<div className="relative mx-auto aspect-square w-full overflow-hidden rounded-full bg-muted ring-2 ring-transparent transition-all group-hover:ring-primary/60">
									{person.profile_path ? (
										<Image
											src={imageUrl(person.profile_path, "w185")!}
											alt={person.name}
											fill
											sizes="(max-width: 640px) 30vw, 15vw"
											className="object-cover transition-transform duration-300 group-hover:scale-110"
										/>
									) : (
										<div className="flex h-full items-center justify-center text-muted-foreground">
											<User className="size-6" />
										</div>
									)}
								</div>
								<p className="mt-2 truncate text-sm font-medium transition-colors group-hover:text-primary">
									{person.name}
								</p>
								<p className="truncate text-xs text-muted-foreground">
									{person.character}
								</p>
							</Link>
						))}
					</div>
				) : (
					<p className="mt-4 text-sm text-muted-foreground">
						No cast information available.
					</p>
				)}
			</section>

			{similar.length > 0 && (
				<section>
					<SectionHeading title="More like this" />
					<MovieGrid movies={similar.slice(0, 10)} className="mt-5" />
				</section>
			)}

			<CommentSection mediaType="tv" mediaId={show.id} />
		</div>
	);
}
