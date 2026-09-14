import { FavoriteButton, WatchedButton } from "@/components/watchlist-button";
import NotifyButton from "@/components/notify-button";
import RatingStars from "@/components/rating-stars";
import { getCurrentUser } from "@/lib/auth";
import { getRating, isSubscribed } from "@/lib/db";
import type { MediaType, MovieType } from "@/types/global";

export default async function DetailAccountActions({
	movie,
}: {
	movie: MovieType;
}) {
	const mediaType = (movie.media_type ?? "movie") as MediaType;
	const user = await getCurrentUser();
	const userRating = user ? await getRating(user.id, mediaType, movie.id) : null;
	const subscribed = user ? await isSubscribed(user.id, mediaType, movie.id) : false;

	return (
		<>
			<RatingStars
				mediaType={mediaType}
				id={movie.id}
				initialRating={userRating}
			/>
			<div className="flex items-center gap-2">
				<FavoriteButton movie={movie} size="large" />
				<WatchedButton movie={movie} size="large" />
				<NotifyButton
					mediaType={mediaType}
					mediaId={movie.id}
					title={movie.title}
					subscribed={subscribed}
				/>
			</div>
		</>
	);
}
