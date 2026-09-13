import { describe, expect, it } from "vitest";

import { imageUrl, year, youtubeThumb } from "@/lib/tmdb";
import { rateLimit } from "@/lib/rate-limit";

describe("year", () => {
	it("extracts the year from a date", () => {
		expect(year("2010-07-15")).toBe("2010");
	});
	it("returns a dash for missing dates", () => {
		expect(year(null)).toBe("—");
		expect(year("")).toBe("—");
		expect(year("garbage")).toBe("—");
	});
});

describe("imageUrl", () => {
	it("builds a TMDB url", () => {
		expect(imageUrl("/abc.jpg", "w500")).toBe(
			"https://image.tmdb.org/t/p/w500/abc.jpg",
		);
	});
	it("returns null for missing paths", () => {
		expect(imageUrl(null)).toBeNull();
		expect(imageUrl(undefined)).toBeNull();
		expect(imageUrl("")).toBeNull();
	});
});

describe("youtubeThumb", () => {
	it("builds a thumbnail url", () => {
		expect(youtubeThumb("abc123")).toBe(
			"https://img.youtube.com/vi/abc123/mqdefault.jpg",
		);
	});
});

describe("rateLimit", () => {
	it("allows under the limit and blocks over it", async () => {
		const key = `test-${Math.random()}`;
		for (let i = 0; i < 3; i++) {
			expect((await rateLimit(key, 3, 1000)).ok).toBe(true);
		}
		const blocked = await rateLimit(key, 3, 1000);
		expect(blocked.ok).toBe(false);
		expect(blocked.retryAfterSec).toBeGreaterThan(0);
	});
	it("separates keys", async () => {
		expect((await rateLimit("a-1", 1, 1000)).ok).toBe(true);
		expect((await rateLimit("a-2", 1, 1000)).ok).toBe(true);
	});
});
