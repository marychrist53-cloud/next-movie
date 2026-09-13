import { afterEach, describe, expect, it, vi } from "vitest";

import { generateOpenAIResponse, getChatLlm } from "@/lib/llm";

describe("getChatLlm", () => {
	afterEach(() => {
		delete process.env.AI_API_KEY;
		delete process.env.AI_BASE_URL;
		delete process.env.AI_MODEL;
		delete process.env.GEMINI_API_KEY;
	});

	it("prefers the OpenAI-compatible AI_* settings", () => {
		process.env.AI_API_KEY = "sk-test";
		process.env.AI_BASE_URL = "https://api.openai.com/v1/";
		process.env.AI_MODEL = "gpt-4o-mini";
		process.env.GEMINI_API_KEY = "gemini-test";

		expect(getChatLlm()).toEqual({
			kind: "openai",
			apiKey: "sk-test",
			baseUrl: "https://api.openai.com/v1",
			model: "gpt-4o-mini",
		});
	});

	it("falls back to Gemini when only GEMINI_API_KEY is set", () => {
		process.env.GEMINI_API_KEY = "gemini-test";
		expect(getChatLlm()).toMatchObject({
			kind: "gemini",
			apiKey: "gemini-test",
		});
	});

	it("treats a non-OpenAI AI_API_KEY as Gemini", () => {
		process.env.AI_API_KEY = "google-studio-key";
		process.env.AI_BASE_URL = "https://api.openai.com/v1";
		process.env.AI_MODEL = "gpt-4o-mini";

		expect(getChatLlm()).toMatchObject({
			kind: "gemini",
			apiKey: "google-studio-key",
			model: "gemini-3.8-flash",
		});
	});
});

describe("generateOpenAIResponse", () => {
	it("sends a movie-expert chat completion and never includes the API key in the body", async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({
				choices: [
					{
						message: {
							content: JSON.stringify({
								reply: "Inception is Nolan's dream heist.",
								titles: ["Inception"],
							}),
						},
					},
				],
			}),
		);

		const response = await generateOpenAIResponse({
			apiKey: "secret-key",
			baseUrl: "https://api.openai.com/v1",
			model: "gpt-4o-mini",
			messages: [{ role: "user", content: "Who directed Inception?" }],
			previous: [],
			live: [],
			fetchImpl: fetchMock as unknown as typeof fetch,
		});

		expect(response).toEqual({
			reply: "Inception is Nolan's dream heist.",
			titles: ["Inception"],
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, options] = fetchMock.mock.calls[0] as unknown as [
			string,
			{ headers?: Record<string, string>; body?: string },
		];
		expect(String(url)).toBe("https://api.openai.com/v1/chat/completions");
		expect(options.headers).toMatchObject({
			Authorization: "Bearer secret-key",
		});
		expect(String(options.body)).not.toContain("secret-key");
		expect(JSON.parse(String(options.body))).toMatchObject({
			model: "gpt-4o-mini",
			response_format: { type: "json_object" },
		});
	});
});
