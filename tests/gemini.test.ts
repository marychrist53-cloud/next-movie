import { describe, expect, it, vi } from "vitest";

import {
	generateGeminiContent,
	generateGeminiResponse,
	identifyPlotTitles,
} from "@/lib/gemini";

function interaction(output: unknown): Response {
	return Response.json({
		status: "completed",
		steps: [
			{
				type: "model_output",
				content: [{ type: "text", text: JSON.stringify(output) }],
			},
		],
	});
}

describe("generateGeminiResponse", () => {
	it("returns a movie-expert draft with official titles", async () => {
		const fetchMock = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				void input;
				void init;
				return interaction({
					reply: "Start with the show, then try the movie.",
					titles: ["Second Show", "Unknown Fake"],
				});
			},
		);

		const response = await generateGeminiResponse({
			apiKey: "secret-key",
			model: "gemini-3.8-flash",
			messages: [{ role: "user", content: "Recommend something" }],
			fetchImpl: fetchMock as unknown as typeof fetch,
		});

		expect(response).toEqual({
			reply: "Start with the show, then try the movie.",
			titles: ["Second Show", "Unknown Fake"],
		});
		const [, options] = fetchMock.mock.calls[0];
		expect(options?.headers).toMatchObject({
			"x-goog-api-key": "secret-key",
		});
		expect(String(options?.body)).not.toContain("secret-key");
		expect(JSON.parse(String(options?.body))).toMatchObject({
			model: "gemini-3.8-flash",
			store: false,
			system_instruction: expect.stringContaining("knowledgeable movie"),
			input: [
				{
					type: "user_input",
					content: [{ type: "text", text: "Recommend something" }],
				},
			],
		});
	});

	it("allows an empty titles list for pure conversation", async () => {
		const fetchImpl = vi.fn(async () =>
			interaction({ reply: "What mood are you in tonight?", titles: [] }),
		) as unknown as typeof fetch;

		const response = await generateGeminiResponse({
			apiKey: "secret-key",
			messages: [{ role: "user", content: "Hi" }],
			fetchImpl,
		});

		expect(response).toEqual({
			reply: "What mood are you in tonight?",
			titles: [],
		});
	});

	it("retries the configured fallback model when the primary is unavailable", async () => {
		const fetchMock = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				void input;
				const body = JSON.parse(String(init?.body)) as { model: string };
				return body.model === "gemini-3.8-flash"
					? new Response("not found", { status: 404 })
					: interaction({ reply: "Fallback answer.", titles: [] });
			},
		);

		const response = await generateGeminiResponse({
			apiKey: "secret-key",
			model: "gemini-3.8-flash",
			fallbackModel: "gemini-3.5-flash",
			messages: [{ role: "user", content: "Recommend something" }],
			fetchImpl: fetchMock as unknown as typeof fetch,
		});

		expect(response.reply).toBe("Fallback answer.");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("asks Gemini for official titles from a plot", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			void input;
			void init;
			return interaction({
				reply: "That sounds like Inception.",
				titles: ["Inception", "The Cell"],
			});
		});

		const response = await identifyPlotTitles({
			apiKey: "secret-key",
			plot: "A thief who enters people's dreams",
			fetchImpl: fetchMock as unknown as typeof fetch,
		});

		expect(response).toEqual({
			reply: "That sounds like Inception.",
			titles: ["Inception", "The Cell"],
		});
	});

	it("rejects API failures and malformed structured output", async () => {
		const failedFetch = vi.fn(
			async () => new Response("quota exceeded", { status: 429 }),
		) as unknown as typeof fetch;
		await expect(
			generateGeminiResponse({
				apiKey: "secret-key",
				messages: [{ role: "user", content: "Hello" }],
				fetchImpl: failedFetch,
			}),
		).rejects.toThrow("status 429");

		const malformedFetch = vi.fn(async () =>
			interaction({ reply: "", titles: ["Inception"] }),
		) as unknown as typeof fetch;
		await expect(
			generateGeminiResponse({
				apiKey: "secret-key",
				messages: [{ role: "user", content: "Hello" }],
				fetchImpl: malformedFetch,
			}),
		).rejects.toThrow("expected schema");
	});
});

describe("generateGeminiContent", () => {
	it("uses the native generateContent API and skips a 503 model", async () => {
		const fetchMock = vi.fn(
			async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes("gemini-3.8-flash")) {
					return new Response("high demand", { status: 503 });
				}
				return Response.json({
					candidates: [
						{
							content: {
								parts: [
									{
										text: JSON.stringify({
											reply: "Christopher Nolan directed Inception.",
											titles: ["Inception"],
										}),
									},
								],
							},
						},
					],
				});
			},
		);

		const response = await generateGeminiContent({
			apiKey: "secret-key",
			model: "gemini-3.8-flash",
			fallbackModel: "gemini-3.5-flash",
			messages: [{ role: "user", content: "Who directed Inception?" }],
			fetchImpl: fetchMock as unknown as typeof fetch,
		});

		expect(response.reply).toMatch(/Nolan/);
		expect(fetchMock).toHaveBeenCalled();
		expect(String(fetchMock.mock.calls[0][0])).toContain(
			"models/gemini-3.8-flash:generateContent",
		);
	});
});
