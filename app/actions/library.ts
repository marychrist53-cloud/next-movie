"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { requireUser } from "@/lib/auth";
import {
	addComment,
	addFavorite,
	addNotifySub,
	addWatchlist,
	adminDeleteComment,
	deleteComment,
	deleteRating,
	getCommentContext,
	getUserProfile,
	importRatings,
	isFavorite,
	isSubscribed,
	isWatchlisted,
	markAllNotificationsRead,
	removeFavorite,
	removeNotifySub,
	removeWatchlist,
	setRating,
	toggleCommentLike,
} from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { refreshNotificationsForUser } from "@/lib/notify";
import {
	isMediaType,
	isValidLibraryItem,
	isValidRating,
	type LibraryItemInput,
	type RatingInput,
} from "@/lib/library-validation";
import type { MediaType } from "@/types/global";

export type ActionState = { error?: string; ok?: boolean };

function revalidateMedia(mediaType: string, mediaId: number) {
	revalidatePath(mediaType === "tv" ? `/tv/${mediaId}` : `/detail/${mediaId}`);
	revalidatePath("/watchlist");
	revalidatePath("/favorites");
	revalidatePath("/notifications");
}

export async function toggleWatchlistAction(item: LibraryItemInput): Promise<ActionState> {
	const user = await requireUser();
	if (!isValidLibraryItem(item)) return { error: "Invalid title data." };
	if (await isWatchlisted(user.id, item.media_type, item.media_id)) {
		await removeWatchlist(user.id, item.media_type, item.media_id);
	} else {
		await addWatchlist(user.id, item);
	}
	revalidateMedia(item.media_type, item.media_id);
	return { ok: true };
}

export async function toggleFavoriteAction(item: LibraryItemInput): Promise<ActionState> {
	const user = await requireUser();
	if (!isValidLibraryItem(item)) return { error: "Invalid title data." };
	if (await isFavorite(user.id, item.media_type, item.media_id)) {
		await removeFavorite(user.id, item.media_type, item.media_id);
	} else {
		await addFavorite(user.id, item);
	}
	revalidateMedia(item.media_type, item.media_id);
	return { ok: true };
}

export async function setRatingAction(
	mediaType: MediaType,
	mediaId: number,
	rating: number | null,
): Promise<ActionState> {
	const user = await requireUser();
	if (!isMediaType(mediaType) || !Number.isInteger(mediaId) || mediaId <= 0) {
		return { error: "Invalid title." };
	}
	if (rating === null) {
		await deleteRating(user.id, mediaType, mediaId);
	} else {
		if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
			return { error: "Rating must be between 1 and 10." };
		}
		await setRating(user.id, mediaType, mediaId, rating);
	}
	revalidateMedia(mediaType, mediaId);
	return { ok: true };
}

export async function addCommentAction(
	mediaType: MediaType,
	mediaId: number,
	body: string,
	parentId: number | null = null,
): Promise<ActionState> {
	const user = await requireUser();
	if (!isMediaType(mediaType) || !Number.isInteger(mediaId) || mediaId <= 0) {
		return { error: "Invalid title." };
	}

	const limit = await rateLimit(`comment:${user.id}`, 10, 60_000);
	if (!limit.ok) {
		return { error: `Slow down — try again in ${limit.retryAfterSec}s.` };
	}

	const trimmed = body.trim();
	if (trimmed.length < 2) return { error: "Comment is too short." };
	if (trimmed.length > 2000) return { error: "Comment is too long (max 2000)." };
	if (parentId !== null) {
		if (!Number.isInteger(parentId) || parentId <= 0) {
			return { error: "Invalid reply target." };
		}
		const parent = await getCommentContext(parentId);
		if (
			!parent ||
			parent.media_type !== mediaType ||
			parent.media_id !== mediaId
		) {
			return { error: "Reply target does not belong to this title." };
		}
	}

	await addComment(user.id, mediaType, mediaId, trimmed, parentId);
	revalidateMedia(mediaType, mediaId);
	return { ok: true };
}

export async function toggleCommentLikeAction(commentId: number): Promise<ActionState> {
	const user = await requireUser();
	if (!Number.isInteger(commentId) || commentId <= 0) {
		return { error: "Comment not found." };
	}
	const comment = await getCommentContext(commentId);
	if (!comment) return { error: "Comment not found." };
	await toggleCommentLike(commentId, user.id);
	revalidateMedia(comment.media_type, comment.media_id);
	return { ok: true };
}

export async function adminDeleteCommentAction(commentId: number): Promise<ActionState> {
	const user = await requireUser();
	const role = (await getUserProfile(user.id))?.role;
	if (role !== "admin" && role !== "owner") {
		return { error: "Admins only." };
	}
	const comment = await getCommentContext(commentId);
	if (!comment) return { error: "Comment not found." };
	await adminDeleteComment(commentId);
	revalidatePath("/admin");
	revalidateMedia(comment.media_type, comment.media_id);
	return { ok: true };
}

export async function adminDeleteCommentFormAction(commentId: number): Promise<void> {
	await adminDeleteCommentAction(commentId);
}

export async function setRegionAction(region: string): Promise<ActionState> {
	const normalized = region.trim().toUpperCase();
	if (!/^[A-Z]{2}$/.test(normalized)) {
		return { error: "Invalid region." };
	}
	const store = await cookies();
	store.set("nm-region", normalized, {
		path: "/",
		maxAge: 60 * 60 * 24 * 365,
	});
	return { ok: true };
}

export async function deleteCommentAction(
	commentId: number,
	mediaType: MediaType,
	mediaId: number,
): Promise<ActionState> {
	const user = await requireUser();
	const comment = await getCommentContext(commentId);
	if (!comment) return { error: "Comment not found." };
	if (comment.media_type !== mediaType || comment.media_id !== mediaId) {
		return { error: "Comment does not belong to this title." };
	}
	await deleteComment(user.id, commentId);
	revalidateMedia(comment.media_type, comment.media_id);
	return { ok: true };
}

export async function toggleNotifyAction(
	mediaType: MediaType,
	mediaId: number,
	title: string,
): Promise<ActionState> {
	const user = await requireUser();
	if (
		!isMediaType(mediaType) ||
		!Number.isInteger(mediaId) ||
		mediaId <= 0 ||
		typeof title !== "string" ||
		!title.trim() ||
		title.length > 300
	) {
		return { error: "Invalid notification subscription." };
	}
	if (await isSubscribed(user.id, mediaType, mediaId)) {
		await removeNotifySub(user.id, mediaType, mediaId);
	} else {
		await addNotifySub(user.id, mediaType, mediaId, title);
	}
	revalidateMedia(mediaType, mediaId);
	return { ok: true };
}

export async function markNotificationsReadAction(): Promise<ActionState> {
	const user = await requireUser();
	await markAllNotificationsRead(user.id);
	revalidatePath("/notifications");
	revalidatePath("/", "layout");
	return { ok: true };
}

export async function refreshNotificationsAction(): Promise<ActionState> {
	const user = await requireUser();
	const limit = await rateLimit(`notification-refresh:${user.id}`, 2, 5 * 60_000);
	if (!limit.ok) {
		return {
			error: `Notifications were checked recently — try again in ${limit.retryAfterSec}s.`,
		};
	}
	await refreshNotificationsForUser(user.id);
	revalidatePath("/notifications");
	revalidatePath("/", "layout");
	return { ok: true };
}

export async function markNotificationsReadForm(): Promise<void> {
	await markNotificationsReadAction();
}

export async function refreshNotificationsForm(): Promise<void> {
	await refreshNotificationsAction();
}

export async function deleteCommentFormAction(formData: FormData): Promise<void> {
	const commentId = Number(formData.get("commentId"));
	const mediaType = String(formData.get("mediaType")) as MediaType;
	const mediaId = Number(formData.get("mediaId"));
	if (!Number.isInteger(commentId) || commentId <= 0) return;
	await deleteCommentAction(commentId, mediaType, mediaId);
}

export async function importLocalDataAction(
	watchlist: LibraryItemInput[],
	ratings: RatingInput[],
	favorites: LibraryItemInput[],
): Promise<ActionState> {
	const user = await requireUser();

	if (
		!Array.isArray(watchlist) ||
		!Array.isArray(ratings) ||
		!Array.isArray(favorites)
	) {
		return { error: "Invalid import data." };
	}
	if (
		watchlist.length > 500 ||
		ratings.length > 1000 ||
		favorites.length > 500
	) {
		return { error: "Import is too large." };
	}

	const validWatchlist = watchlist.filter(isValidLibraryItem);
	const validRatings = ratings.filter(isValidRating);
	const validFavorites = favorites.filter(isValidLibraryItem);
	if (
		validWatchlist.length !== watchlist.length ||
		validRatings.length !== ratings.length ||
		validFavorites.length !== favorites.length
	) {
		return { error: "Import contains invalid data." };
	}

	for (const item of validWatchlist) {
		await addWatchlist(user.id, item);
	}
	for (const item of validFavorites) {
		await addFavorite(user.id, item);
	}
	await importRatings(user.id, validRatings);

	revalidatePath("/", "layout");
	return { ok: true };
}
