import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const maxDuration = 60;

import { getAllNotifySubUsers } from "@/lib/db";
import { refreshNotificationsForUser } from "@/lib/notify";

function secretsMatch(provided: string | undefined, expected: string): boolean {
	if (!provided) return false;
	const providedBuffer = Buffer.from(provided);
	const expectedBuffer = Buffer.from(expected);
	return (
		providedBuffer.length === expectedBuffer.length &&
		timingSafeEqual(providedBuffer, expectedBuffer)
	);
}

export async function GET(request: Request) {
	const secret = process.env.CRON_SECRET?.trim();
	if (!secret) {
		console.error("[cron] CRON_SECRET is not configured");
		return NextResponse.json(
			{ error: "Cron is not configured" },
			{ status: 503 },
		);
	}

	const authorization = request.headers.get("authorization");
	const provided = authorization?.startsWith("Bearer ")
		? authorization.slice("Bearer ".length)
		: undefined;

	if (!secretsMatch(provided, secret)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const userIds = await getAllNotifySubUsers();
	let checked = 0;
	let failed = 0;

	for (let index = 0; index < userIds.length; index += 5) {
		const batch = userIds.slice(index, index + 5);
		const results = await Promise.allSettled(
			batch.map(userId => refreshNotificationsForUser(userId)),
		);
		for (const [resultIndex, result] of results.entries()) {
			if (result.status === "fulfilled") {
				checked += 1;
			} else {
				failed += 1;
				console.error(
					`[cron] notification refresh failed for user ${batch[resultIndex]}`,
					result.reason,
				);
			}
		}
	}

	return NextResponse.json({
		ok: failed === 0,
		usersChecked: checked,
		usersFailed: failed,
	});
}
