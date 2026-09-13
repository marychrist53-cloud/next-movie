import {
	clearRateLimit,
	consumeRateLimit,
	getRateLimitBucket,
	pruneExpiredRateLimits,
} from "@/lib/db";

export function rateLimit(
	key: string,
	limit: number,
	windowMs: number,
): { ok: boolean; retryAfterSec: number } {
	periodicallyPruneRateLimits();
	const bucket = consumeRateLimit(key, windowMs);
	const ok = !bucket || bucket.count <= limit;
	return {
		ok,
		retryAfterSec: ok
			? 0
			: Math.max(1, Math.ceil((bucket.reset_at - Date.now()) / 1000)),
	};
}

export function checkRateLimit(
	key: string,
	limit: number,
): { ok: boolean; retryAfterSec: number } {
	const bucket = getRateLimitBucket(key);
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
export function periodicallyPruneRateLimits() {
	callsSincePrune += 1;
	if (callsSincePrune % 100 === 0) pruneExpiredRateLimits();
}
