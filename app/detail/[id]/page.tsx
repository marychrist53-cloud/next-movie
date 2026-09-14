import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
	CalendarDays,
	Clock,
	Film,
	Rss,
	Star,
	User,
} from "lucide-react";

import MovieGrid from "@/components/movie-grid";
import CommentSection from "@/components/comment-section";
import DetailAccountActions from "@/components/detail-account-actions";
import JsonLd from "@/components/json-ld";
import SectionHeading from "@/components/section-heading";
import TrailerButton from "@/components/trailer-button";
import VideoGrid from "@/components/video-grid";
import WatchProviders from "@/components/watch-providers";
import {
	fetchCast,
	fetchMovie,
	fetchReleaseDates,
	fetchReviews,
	fetchSimilar,
	fetchVideos,
	imageUrl,
	year,
} from "@/lib/tmdb";
import type {
	CastMemberType,
	MovieType,
	ReviewType,
	VideoType,
} from "@/types/global";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { id } = await params;
	try {
		const movie = await fetchMovie(id);
		const poster = imageUrl(movie.poster_path, "w780");
		return {
			title: movie.title,
			description:
				movie.overview?.slice(0, 160) ||
				`Discover ${movie.title} on Next Movie.`,
			openGraph: {
				title: movie.title,
				description: movie.overview?.slice(0, 200),
				images: poster ? [{ url: poster, width: 780, height: 1170 }] : [],
				type: "video.movie",
			},
			twitter: {
				card: poster ? "summary_large_image" : "summary",
				title: movie.title,
				description: movie.overview?.slice(0, 200),
				images: poster ? [poster] : [],
			},
			alternates: { canonical: `/detail/${id}` },
		};
	} catch {
		return { title: "Movie" };
	}
}

function formatRuntime(minutes?: number | null): string | null {
	if (!minutes || minutes <= 0) return null;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatFullDate(date: string): string {
	return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
}

function isPastDate(date: string): boolean {
	return date <= new Date().toISOString().slice(0, 10);
}

function avatarUrl(review: ReviewType): string | null {
	const path = review.author_details?.avatar_path;
	if (!path) return null;
	if (path.startsWith("/")) {
		return `https://image.tmdb.org/t/p/w92${path}`;
	}
	return path.replace(/^http:/, "https:");
}

function Reviews({ reviews }: { reviews: ReviewType[] }) {
	if (!reviews.length) return null;

	return (
		<section>
			<SectionHeading icon={<Rss className="size-4.5" />} title="Reviews" />
			<div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
				{reviews.map(review => {
					const avatar = avatarUrl(review);
					return (
						<article
							key={review.id}
							className="rounded-2xl border border-border/60 p-5">
							<div className="flex items-center gap-3">
								<div className="relative size-9 shrink-0 overflow-hidden rounded-full bg-muted">
									{avatar ? (
										// eslint-disable-next-line @next/next/no-img-element
										<img
											src={avatar}
											alt=""
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="flex h-full items-center justify-center text-muted-foreground">
											<User className="size-4" />
										</div>
									)}
								</div>
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold">
										{review.author_details?.username || review.author}
									</p>
									<p className="text-xs text-muted-foreground">
										{new Date(review.created_at).toLocaleDateString("en-US", {
											year: "numeric",
											month: "short",
											day: "numeric",
										})}
									</p>
								</div>
								{typeof review.author_details?.rating === "number" && (
									<span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-400">
										<Star className="size-3 fill-current" />
										{review.author_details.rating}/10
									</span>
								)}
							</div>
							<p className="mt-3 line-clamp-6 text-sm leading-relaxed text-muted-foreground">
								{review.content.replace(/_/g, "")}
							</p>
						</article>
					);
				})}
			</div>
		</section>
	);
}

async function SimilarMovies({ id }: { id: string }) {
	let movies: MovieType[] = [];
	try {
		movies = await fetchSimilar("movie", id);
	} catch {
		return null;
	}
	if (!movies.length) return null;

	return (
		<section>
			<SectionHeading title="More like this" />
			<MovieGrid movies={movies.slice(0, 10)} className="mt-5" />
		</section>
	);
}

export default async function MovieDetail({ params }: Props) {
	const { id } = await params;

	let movie: MovieType;
	let cast: CastMemberType[] = [];
	let videos: VideoType[] = [];
	let reviews: ReviewType[] = [];
	let releaseDates = { theatrical: null as string | null, digital: null as string | null };
	try {
		movie = await fetchMovie(id);
	} catch {
		notFound();
	}

	const [castResult, videosResult, reviewsResult, datesResult] =
		await Promise.allSettled([
			fetchCast("movie", id),
			fetchVideos("movie", id),
			fetchReviews("movie", id),
			fetchReleaseDates(id),
		]);
	if (castResult.status === "fulfilled") cast = castResult.value;
	else console.error(`[movie] failed to load cast for ${id}`, castResult.reason);
	if (videosResult.status === "fulfilled") videos = videosResult.value;
	else console.error(`[movie] failed to load videos for ${id}`, videosResult.reason);
	if (reviewsResult.status === "fulfilled") reviews = reviewsResult.value;
	else console.error(`[movie] failed to load reviews for ${id}`, reviewsResult.reason);
	if (datesResult.status === "fulfilled") releaseDates = datesResult.value;
	else console.error(`[movie] failed to load release dates for ${id}`, datesResult.reason);

	const trailer = videos[0] ?? null;

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "Movie",
		name: movie.title,
		description: movie.overview,
		image: imageUrl(movie.poster_path, "w780") ?? undefined,
		datePublished: movie.release_date ?? undefined,
		url: `/detail/${movie.id}`,
		...(movie.vote_average > 0 && {
			aggregateRating: {
				"@type": "AggregateRating",
				ratingValue: movie.vote_average.toFixed(1),
				bestRating: 10,
				ratingCount: movie.vote_count ?? 0,
			},
		}),
	};

	const backdrop = imageUrl(movie.backdrop_path, "w1280");
	const poster = imageUrl(movie.poster_path, "w500");
	const runtime = formatRuntime(movie.runtime);
	const isReleased = movie.status === "Released";
	const today = new Date().toISOString().slice(0, 10);
	const inTheaters =
		!!releaseDates.theatrical &&
		releaseDates.theatrical <= today &&
		(!releaseDates.digital || releaseDates.digital > today);
	const notYetReleased = !isReleased && !!movie.release_date && movie.release_date > today;

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
							<Film className="size-12" />
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
							alt={movie.title}
							fill
							sizes="(max-width: 640px) 144px, 208px"
							className="object-cover"
						/>
					</div>
				)}
				<div className="min-w-0 pb-2">
					<h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
						{movie.title}
					</h1>
					{movie.tagline && (
						<p className="mt-1.5 text-sm italic text-muted-foreground">
							“{movie.tagline}”
						</p>
					)}
					<div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
						{movie.vote_average > 0 && (
							<span className="inline-flex items-center gap-1.5 font-semibold text-amber-400">
								<Star className="size-4 fill-amber-400" />
								{movie.vote_average.toFixed(1)}
								<span className="font-normal text-muted-foreground">
									({movie.vote_count?.toLocaleString()} votes)
								</span>
							</span>
						)}
						<span className="inline-flex items-center gap-1.5">
							<CalendarDays className="size-4" />
							{year(movie.release_date)}
						</span>
						{runtime && (
							<span className="inline-flex items-center gap-1.5">
								<Clock className="size-4" />
								{runtime}
							</span>
						)}
					</div>
					{!!movie.genres?.length && (
						<div className="mt-4 flex flex-wrap gap-2">
							{movie.genres.map(genre => (
								<Link
									key={genre.id}
									href={`/genre/${encodeURIComponent(genre.name)}/${genre.id}`}
									className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
									{genre.name}
								</Link>
							))}
						</div>
					)}
					<div className="mt-5 flex flex-wrap items-center gap-4">
						{trailer && <TrailerButton videoKey={trailer.key} title={movie.title} />}
						<Suspense
							fallback={
								<div className="h-10 w-56 animate-pulse rounded-full bg-muted" />
							}>
							<DetailAccountActions movie={movie} />
						</Suspense>
					</div>
				</div>
			</section>

			<section className="max-w-3xl">
				<h2 className="text-xl font-bold tracking-tight">Overview</h2>
				<p className="mt-3 leading-relaxed text-muted-foreground">
					{movie.overview || "No overview available."}
				</p>
			</section>

			<section>
				<SectionHeading
					icon={<CalendarDays className="size-4.5" />}
					title="Release schedule"
				/>
				<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
					<div className="rounded-xl border border-border/60 p-4">
						<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							{inTheaters ? "In theaters now" : notYetReleased ? "Expected in theaters" : "Theaters"}
						</p>
						<p className="mt-1 font-semibold">
							{releaseDates.theatrical
								? formatFullDate(releaseDates.theatrical)
								: movie.release_date
									? formatFullDate(movie.release_date)
									: "TBA"}
						</p>
						{inTheaters && (
							<span className="mt-2 inline-block rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
								In theaters
							</span>
						)}
					</div>
					<div className="rounded-xl border border-border/60 p-4">
						<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							{releaseDates.digital && !isPastDate(releaseDates.digital)
								? "Expected digital release"
								: "Digital release"}
						</p>
						<p className="mt-1 font-semibold">
							{releaseDates.digital
								? formatFullDate(releaseDates.digital)
								: notYetReleased
									? "TBA"
									: "Unknown"}
						</p>
					</div>
				</div>
			</section>

			<Suspense
				fallback={
					<div className="h-24 animate-pulse rounded-2xl bg-muted" />
				}>
				<WatchProviders mediaType="movie" id={id} />
			</Suspense>

			{!!videos.length && (
				<section>
					<SectionHeading title="Videos" />
					<div className="mt-5">
						<VideoGrid videos={videos} title={movie.title} />
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

			<Reviews reviews={reviews} />

			<Suspense
				fallback={
					<div className="h-48 animate-pulse rounded-2xl bg-muted" />
				}>
				<CommentSection mediaType="movie" mediaId={movie.id} />
			</Suspense>

			<SimilarMovies id={id} />
		</div>
	);
}
