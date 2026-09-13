import webpush from "web-push";

import {
	getNotifySubs,
	getPushSubscriptions,
	prunePushSubscription,
	upsertNotification,
} from "@/lib/db";
import { fetchMovie, fetchReleaseDates, fetchTv } from "@/lib/tmdb";

function isPast(date: string | null | undefined): boolean {
	if (!date) return false;
	return new Date(`${date}T00:00:00Z`).getTime() <= Date.now();
}

function formatDate(date: string): string {
	return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
}

let vapidKeys: { publicKey: string; privateKey: string } | null = null;

export function getVapidKeys() {
	if (vapidKeys) return vapidKeys;
	const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
	const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
	if (!publicKey || !privateKey) {
		throw new Error(
			"Push notifications require VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
		);
	}
	vapidKeys = { publicKey, privateKey };
	return vapidKeys;
}

async function sendPushToUser(
	userId: number,
	payload: { title: string; body: string; url: string },
) {
	const subs = getPushSubscriptions(userId);
	if (!subs.length) return;
	let keys;
	try {
		keys = getVapidKeys();
	} catch (error) {
		console.error("[push] VAPID keys are not configured", error);
		return;
	}
	const subject =
		process.env.VAPID_SUBJECT?.trim() || "mailto:hello@nextmovie.app";

	await Promise.allSettled(
		subs.map(async sub => {
			try {
				await webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: { p256dh: sub.p256dh, auth: sub.auth },
					},
					JSON.stringify(payload),
					{ vapidDetails: { subject, ...keys } },
				);
			} catch (err) {
				if (typeof err === "object" && err && "statusCode" in err) {
					const status = (err as { statusCode: number }).statusCode;
					if (status === 404 || status === 410) {
						prunePushSubscription(sub.endpoint);
					} else {
						console.error(
							`[push] delivery failed with status ${status}`,
							err,
						);
					}
				} else {
					console.error("[push] delivery failed", err);
				}
			}
		}),
	);
}

export async function refreshNotificationsForUser(userId: number) {
	const subs = getNotifySubs(userId);

	const results = await Promise.allSettled(
		subs.map(async sub => {
			if (sub.media_type === "movie") {
				const [movie, dates] = await Promise.all([
					fetchMovie(String(sub.media_id)),
					fetchReleaseDates(String(sub.media_id)),
				]);

				if (isPast(movie.release_date)) {
					const isNew = upsertNotification({
						userId,
						mediaType: "movie",
						mediaId: sub.media_id,
						kind: "released",
						title: sub.title,
						message: `Released in theaters on ${formatDate(movie.release_date!)}`,
						dueDate: movie.release_date,
					});
					if (isNew) {
						await sendPushToUser(userId, {
							title: `${sub.title} — now in theaters`,
							body: `Released in theaters on ${formatDate(movie.release_date!)}`,
							url: `/detail/${sub.media_id}`,
						});
					}
				}
				if (isPast(dates.digital)) {
					const isNew = upsertNotification({
						userId,
						mediaType: "movie",
						mediaId: sub.media_id,
						kind: "digital",
						title: sub.title,
						message: `Now available on digital — since ${formatDate(dates.digital!)}`,
						dueDate: dates.digital,
					});
					if (isNew) {
						await sendPushToUser(userId, {
							title: `${sub.title} — available on digital`,
							body: `Digital release since ${formatDate(dates.digital!)}`,
							url: `/detail/${sub.media_id}`,
						});
					}
				}
			} else {
				const show = await fetchTv(String(sub.media_id));
				const last = show.last_episode_to_air;
				if (last && isPast(last.air_date)) {
					const isNew = upsertNotification({
						userId,
						mediaType: "tv",
						mediaId: sub.media_id,
						kind: `ep-${last.season_number}-${last.episode_number}`,
						title: sub.title,
						message: `S${last.season_number}E${last.episode_number} “${last.name ?? "New episode"}” aired on ${formatDate(last.air_date!)}`,
						dueDate: last.air_date,
					});
					if (isNew) {
						await sendPushToUser(userId, {
							title: `${sub.title} — new episode`,
							body: `S${last.season_number}E${last.episode_number} aired on ${formatDate(last.air_date!)}`,
							url: `/tv/${sub.media_id}`,
						});
					}
				}
			}
		}),
	);

	const failures = results.flatMap((result, index) =>
		result.status === "rejected"
			? [{ subscription: subs[index], reason: result.reason }]
			: [],
	);
	if (failures.length) {
		for (const failure of failures) {
			console.error(
				`[notifications] refresh failed for ${failure.subscription.media_type}/${failure.subscription.media_id}`,
				failure.reason,
			);
		}
		throw new AggregateError(
			failures.map(failure => failure.reason),
			`Failed to refresh ${failures.length} notification subscription(s).`,
		);
	}
}
