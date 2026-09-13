import {
	clearRateLimit,
	consumeRateLimit,
	getRateLimitBucket,
	pruneExpiredRateLimits,
} from "@/lib/db";

export async function rateLimit(
	key: string,
	limit: number,
	windowMs: number,
): Promise<{ ok: boolean; retryAfterSec: number }> {
	await periodicallyPruneRateLimits();
	const bucket = await consumeRateLimit(key, windowMs);
	const ok = !bucket || bucket.count <= limit;
	return {
		ok,
		retryAfterSec: ok
			? 0
			: Math.max(1, Math.ceil((bucket.reset_at - Date.now()) / 1000)),
	};
}

export async function checkRateLimit(
	key: string,
	limit: number,
): Promise<{ ok: boolean; retryAfterSec: number }> {
	const bucket = await getRateLimitBucket(key);
	if (!bucket || bucket.count < limit) {
		return { ok: true, retryAfterSec: 0 };
	}
	return {
		ok: false,
		retryAfterSec: Math.max(
			1,
			Math.ceil((bucket.reset_at - Date.now()) / 1000),
		),
	};
}

export { clearRateLimit };

let callsSincePrune = 0;
export async function periodicallyPruneRateLimits() {
	callsSincePrune += 1;
	if (callsSincePrune % 100 === 0) await pruneExpiredRateLimits();
}
