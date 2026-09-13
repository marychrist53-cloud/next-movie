import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => new Headers({ "x-real-ip": "127.0.0.1" })),
}));
vi.mock("@/lib/rate-limit", () => ({
	rateLimit: vi.fn(() => ({ ok: true, retryAfterSec: 0 })),
}));
vi.mock("@/lib/ai", () => ({
	answerChat: vi.fn(async () => ({ reply: "Hello", mode: "local" })),
}));

import { POST } from "@/app/api/chat/route";
import { answerChat } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";

const mockedAnswer = vi.mocked(answerChat);
const mockedRateLimit = vi.mocked(rateLimit);

describe("chat route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedRateLimit.mockResolvedValue({ ok: true, retryAfterSec: 0 });
		mockedAnswer.mockResolvedValue({ reply: "Hello", mode: "local" });
	});

	it("validates and limits messages before calling the assistant", async () => {
		const response = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: [
						{ role: "assistant", content: "Earlier" },
						{ role: "invalid", content: "Discard me" },
						{ role: "user", content: "x".repeat(2_500) },
					],
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("content-type")).toContain("text/event-stream");
		expect(await response.text()).toContain('"type":"done"');
		expect(mockedAnswer).toHaveBeenCalledWith([
			{ role: "assistant", content: "Earlier", results: undefined },
			{ role: "user", content: "x".repeat(2_000), results: undefined },
		]);
	});

	it("rejects oversized and invalid requests", async () => {
		const oversized = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": "32001",
				},
				body: JSON.stringify({ messages: [] }),
			}),
		);
		expect(oversized.status).toBe(413);
		expect(mockedAnswer).not.toHaveBeenCalled();

		const invalid = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messages: [{ role: "assistant", content: "No" }] }),
			}),
		);
		expect(invalid.status).toBe(400);
	});

	it("keeps previous recommendation cards for follow-ups", async () => {
		const response = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: [
						{
							role: "assistant",
							content: "Try these",
							results: [
								{
									id: 1,
									media_type: "movie",
									title: "Space Movie",
									poster_path: "/space.jpg",
									release_date: "2026-01-01",
									vote_average: 8,
									overview: "A science-fiction adventure.",
								},
							],
						},
						{ role: "user", content: "more like that" },
					],
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(mockedAnswer).toHaveBeenCalledWith([
			{
				role: "assistant",
				content: "Try these",
				results: [
					{
						id: 1,
						media_type: "movie",
						title: "Space Movie",
						poster_path: "/space.jpg",
						release_date: "2026-01-01",
						vote_average: 8,
						overview: "A science-fiction adventure.",
					},
				],
			},
			{ role: "user", content: "more like that", results: undefined },
		]);
	});

	it("returns retry timing when rate limited", async () => {
		mockedRateLimit.mockResolvedValue({ ok: false, retryAfterSec: 12 });
		const response = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				body: JSON.stringify({
					messages: [{ role: "user", content: "Hello" }],
				}),
			}),
		);

		expect(response.status).toBe(429);
		expect(await response.json()).toEqual({
			error: "Rate limit reached — try again in 12s.",
		});
	});
});
