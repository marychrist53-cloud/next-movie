import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
	requireUser: vi.fn(async () => ({ id: 42, name: "Test", email: "test@example.test" })),
}));
vi.mock("@/lib/db", () => ({
	addComment: vi.fn(),
	addFavorite: vi.fn(),
	addNotifySub: vi.fn(),
	addWatchlist: vi.fn(),
	adminDeleteComment: vi.fn(),
	deleteComment: vi.fn(),
	deleteRating: vi.fn(),
	getCommentContext: vi.fn(),
	getUserProfile: vi.fn(),
	importRatings: vi.fn(),
	isFavorite: vi.fn(),
	isSubscribed: vi.fn(),
	isWatchlisted: vi.fn(),
	markAllNotificationsRead: vi.fn(),
	removeFavorite: vi.fn(),
	removeNotifySub: vi.fn(),
	removeWatchlist: vi.fn(),
	setRating: vi.fn(),
	toggleCommentLike: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
	rateLimit: vi.fn(() => ({ ok: true, retryAfterSec: 0 })),
}));
vi.mock("@/lib/notify", () => ({
	refreshNotificationsForUser: vi.fn(),
}));

import {
	importLocalDataAction,
	refreshNotificationsAction,
} from "@/app/actions/library";
import { addFavorite, addWatchlist, importRatings } from "@/lib/db";
import { refreshNotificationsForUser } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";

const item = {
	media_type: "movie" as const,
	media_id: 123,
	title: "Imported Movie",
	poster_path: "/poster.jpg",
	release_date: "2026-09-07",
	vote_average: 8,
};

describe("library actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfterSec: 0 });
	});

	it("imports guest watchlist, ratings, and favorites", async () => {
		const ratings = [{ mediaType: "movie" as const, id: 123, rating: 9 }];
		const result = await importLocalDataAction([item], ratings, [item]);

		expect(result).toEqual({ ok: true });
		expect(addWatchlist).toHaveBeenCalledWith(42, item);
		expect(addFavorite).toHaveBeenCalledWith(42, item);
		expect(importRatings).toHaveBeenCalledWith(42, ratings);
	});

	it("rate limits manual notification refreshes", async () => {
		vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfterSec: 30 });

		const result = await refreshNotificationsAction();

		expect(result.error).toContain("30s");
		expect(refreshNotificationsForUser).not.toHaveBeenCalled();
	});
});
