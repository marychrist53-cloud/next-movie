import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tmdb", () => ({
	fetchDiscover: vi.fn(),
	fetchGenres: vi.fn(),
	fetchMediaList: vi.fn(),
	fetchSearchMulti: vi.fn(),
	fetchSimilar: vi.fn(),
}));
vi.mock("@/lib/gemini", () => ({
	DEFAULT_GEMINI_MODEL: "gemini-3.6-flash",
	DEFAULT_GEMINI_FALLBACK_MODEL: "gemini-3.5-flash",
	generateGeminiResponse: vi.fn(),
	generateGeminiContent: vi.fn(),
	identifyPlotTitles: vi.fn(),
}));
vi.mock("@/lib/llm", async importOriginal => {
	const actual = await importOriginal<typeof import("@/lib/llm")>();
	return {
		...actual,
		generateOpenAIResponse: vi.fn(),
		generateOpenAIStream: vi.fn(),
	};
});

import { answerChat } from "@/lib/ai";
import { generateGeminiContent, generateGeminiResponse } from "@/lib/gemini";
import { generateOpenAIStream } from "@/lib/llm";
import {
	fetchDiscover,
	fetchGenres,
	fetchMediaList,
	fetchSearchMulti,
	fetchSimilar,
} from "@/lib/tmdb";
import type { MovieType } from "@/types/global";

const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalAiKey = process.env.AI_API_KEY;
const movie = {
	id: 1,
	title: "Space Movie",
	overview: "A science-fiction adventure.",
	poster_path: "/space.jpg",
	backdrop_path: null,
	release_date: "2026-01-01",
	vote_average: 8,
	media_type: "movie",
} as MovieType;

describe("local chat routing", () => {
	beforeEach(() => {
		delete process.env.GEMINI_API_KEY;
		delete process.env.AI_API_KEY;
		delete process.env.AI_BASE_URL;
		delete process.env.AI_MODEL;
		vi.clearAllMocks();
		vi.mocked(generateGeminiContent).mockRejectedValue(
			new Error("native Gemini skipped in unit tests"),
		);
	});

	afterAll(() => {
		if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
		else process.env.GEMINI_API_KEY = originalGeminiKey;
		if (originalAiKey === undefined) delete process.env.AI_API_KEY;
		else process.env.AI_API_KEY = originalAiKey;
	});

	it("routes genre recommendations to TMDB discovery", async () => {
		vi.mocked(fetchGenres).mockResolvedValue([
			{ id: 878, name: "Science Fiction" },
		]);
		vi.mocked(fetchDiscover).mockResolvedValue({
			page: 1,
			total_pages: 1,
			total_results: 1,
			results: [movie],
		});

		const response = await answerChat([
			{ role: "user", content: "Recommend me a sci-fi movie" },
		]);

		expect(fetchDiscover).toHaveBeenCalledWith(
			expect.objectContaining({ genres: ["878"] }),
		);
		expect(fetchSearchMulti).not.toHaveBeenCalled();
		expect(response.results?.[0].title).toBe("Space Movie");
	});

	it("only uses the similar-title path for an explicit comparison", async () => {
		vi.mocked(fetchSearchMulti).mockResolvedValue({
			page: 1,
			total_pages: 1,
			total_results: 1,
			results: [movie],
		});
		vi.mocked(fetchSimilar).mockResolvedValue([
			{ ...movie, id: 2, title: "Another Space Movie" },
		]);

		const response = await answerChat([
			{ role: "user", content: "Movies similar to Space Movie" },
		]);

		expect(fetchSearchMulti).toHaveBeenCalledWith("Space Movie", 1);
		expect(fetchSimilar).toHaveBeenCalledWith("movie", "1");
		expect(response.results?.[0].title).toBe("Another Space Movie");
	});

	it("identifies a film from a short plot description", async () => {
		vi.mocked(fetchSearchMulti).mockResolvedValue({
			page: 1,
			total_pages: 1,
			total_results: 1,
			results: [
				{
					...movie,
					id: 27205,
					title: "Inception",
					overview:
						"A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea.",
					poster_path: "/inception.jpg",
					vote_average: 8.4,
				},
			],
		});

		const response = await answerChat([
			{ role: "user", content: "A thief who enters people's dreams" },
		]);

		expect(fetchSearchMulti).toHaveBeenCalled();
		expect(fetchDiscover).not.toHaveBeenCalled();
		expect(response.reply).toMatch(/plot/i);
		expect(response.results?.[0].title).toBe("Inception");
	});

	it("uses the configured AI model as the movie expert", async () => {
		process.env.AI_API_KEY = "sk-test-key";
		process.env.AI_BASE_URL = "https://api.openai.com/v1";
		process.env.AI_MODEL = "gpt-4o-mini";
		vi.mocked(generateOpenAIStream).mockResolvedValue({
			reply: "That sounds like Inception — Nolan's dream-heist film.",
			titles: ["Inception"],
		});
		vi.mocked(fetchSearchMulti).mockResolvedValue({
			page: 1,
			total_pages: 1,
			total_results: 1,
			results: [
				{
					...movie,
					id: 27205,
					title: "Inception",
					overview: "A thief enters dreams.",
					poster_path: "/inception.jpg",
				},
			],
		});

		const response = await answerChat([
			{ role: "user", content: "A thief who enters people's dreams" },
		]);

		expect(generateOpenAIStream).toHaveBeenCalledWith(
			expect.objectContaining({
				apiKey: "sk-test-key",
				model: "gpt-4o-mini",
			}),
		);
		expect(generateGeminiResponse).not.toHaveBeenCalled();
		expect(fetchSearchMulti).toHaveBeenCalledWith("Inception", 1);
		expect(response).toMatchObject({
			mode: "ai",
			reply: "That sounds like Inception — Nolan's dream-heist film.",
			results: [{ title: "Inception", id: 27205 }],
		});
	});

	it("streams Gemini through the OpenAI-compatible endpoint", async () => {
		process.env.AI_API_KEY = "google-studio-key";
		vi.mocked(generateOpenAIStream).mockResolvedValue({
			reply: "Christopher Nolan directed Inception.",
			titles: ["Inception"],
		});
		vi.mocked(fetchSearchMulti).mockResolvedValue({
			page: 1,
			total_pages: 1,
			total_results: 1,
			results: [
				{
					...movie,
					id: 27205,
					title: "Inception",
					poster_path: "/inception.jpg",
				},
			],
		});

		const response = await answerChat([
			{ role: "user", content: "Who directed Inception?" },
		]);

		expect(generateOpenAIStream).toHaveBeenCalledWith(
			expect.objectContaining({
				apiKey: "google-studio-key",
				baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
			}),
		);
		expect(generateGeminiResponse).not.toHaveBeenCalled();
		expect(response).toMatchObject({
			mode: "ai",
			reply: "Christopher Nolan directed Inception.",
			results: [{ title: "Inception", id: 27205 }],
		});
	});

	it("answers Gemini through generateContent before streaming", async () => {
		process.env.AI_API_KEY = "google-studio-key";
		vi.mocked(generateGeminiContent).mockResolvedValue({
			reply: "Christopher Nolan directed Inception.",
			titles: ["Inception"],
		});
		vi.mocked(fetchSearchMulti).mockResolvedValue({
			page: 1,
			total_pages: 1,
			total_results: 1,
			results: [
				{
					...movie,
					id: 27205,
					title: "Inception",
					poster_path: "/inception.jpg",
				},
			],
		});

		const response = await answerChat([
			{ role: "user", content: "Who directed Inception?" },
		]);

		expect(generateGeminiContent).toHaveBeenCalledWith(
			expect.objectContaining({ apiKey: "google-studio-key" }),
		);
		expect(generateOpenAIStream).not.toHaveBeenCalled();
		expect(response).toMatchObject({
			mode: "ai",
			reply: "Christopher Nolan directed Inception.",
		});
	});

	it("falls back to the Interactions API when Gemini streaming fails", async () => {
		process.env.GEMINI_API_KEY = "google-studio-key";
		vi.mocked(generateOpenAIStream).mockRejectedValue(
			new Error("AI request failed with status 404."),
		);
		vi.mocked(generateGeminiResponse).mockResolvedValue({
			reply: "Nolan directed Inception in 2010.",
			titles: ["Inception"],
		});
		vi.mocked(fetchSearchMulti).mockResolvedValue({
			page: 1,
			total_pages: 1,
			total_results: 1,
			results: [{ ...movie, id: 27205, title: "Inception" }],
		});

		const response = await answerChat([
			{ role: "user", content: "Who directed Inception?" },
		]);

		expect(generateGeminiResponse).toHaveBeenCalledWith(
			expect.objectContaining({ apiKey: "google-studio-key" }),
		);
		expect(response.mode).toBe("ai");
		expect(response.reply).toMatch(/Nolan/);
	});

	it("forwards streamed tokens from the model", async () => {
		process.env.AI_API_KEY = "sk-test-key";
		process.env.AI_BASE_URL = "https://api.openai.com/v1";
		const tokens: string[] = [];
		vi.mocked(generateOpenAIStream).mockImplementation(async ({ onToken }) => {
			onToken?.("Inception ");
			onToken?.("is a dream heist.");
			return { reply: "Inception is a dream heist.", titles: ["Inception"] };
		});
		vi.mocked(fetchSearchMulti).mockResolvedValue({
			page: 1,
			total_pages: 1,
			total_results: 1,
			results: [{ ...movie, id: 27205, title: "Inception" }],
		});

		const response = await answerChat(
			[{ role: "user", content: "Tell me about Inception" }],
			{ onToken: text => tokens.push(text) },
		);

		expect(tokens).toEqual(["Inception ", "is a dream heist."]);
		expect(response.reply).toBe("Inception is a dream heist.");
	});

	it("does not treat a recommendation follow-up as a plot search", async () => {
		vi.mocked(fetchSearchMulti).mockResolvedValue({
			page: 1,
			total_pages: 1,
			total_results: 1,
			results: [movie],
		});
		vi.mocked(fetchSimilar).mockResolvedValue([
			{ ...movie, id: 2, title: "Another Space Movie" },
		]);

		const response = await answerChat([
			{ role: "user", content: "Who directed Space Movie?" },
			{
				role: "assistant",
				content: "Ava directed Space Movie.",
				results: [
					{
						id: 1,
						media_type: "movie",
						title: "Space Movie",
						poster_path: "/space.jpg",
						release_date: "2026-01-01",
						vote_average: 8,
					},
				],
			},
			{
				role: "user",
				content: "What should I watch next if I loved the dream layers?",
			},
		]);

		expect(response.reply).not.toMatch(/plot you described/i);
		expect(fetchSimilar).toHaveBeenCalledWith("movie", "1");
		expect(response.results?.[0].title).toBe("Another Space Movie");
	});

	it("strips question phrasing before searching the catalog", async () => {
		vi.mocked(fetchSearchMulti).mockResolvedValue({
			page: 1,
			total_pages: 1,
			total_results: 1,
			results: [{ ...movie, id: 27205, title: "Inception" }],
		});

		const response = await answerChat([
			{ role: "user", content: "Who directed Inception?" },
		]);

		expect(fetchSearchMulti).toHaveBeenCalledWith("Inception", 1);
		expect(response.results?.[0].title).toBe("Inception");
	});

	it("answers greetings without searching the catalog", async () => {
		const response = await answerChat([{ role: "user", content: "Hey" }]);

		expect(response.reply).toMatch(/hey|mood|genre|plot/i);
		expect(fetchSearchMulti).not.toHaveBeenCalled();
		expect(fetchDiscover).not.toHaveBeenCalled();
		expect(fetchMediaList).not.toHaveBeenCalled();
	});

	it("falls back to the local assistant when the movie model hangs", async () => {
		process.env.AI_API_KEY = "sk-test-key";
		process.env.AI_BASE_URL = "https://api.openai.com/v1";
		vi.mocked(generateOpenAIStream).mockImplementation(() => new Promise(() => {}));
		vi.mocked(fetchSearchMulti).mockResolvedValue({
			page: 1,
			total_pages: 1,
			total_results: 1,
			results: [{ ...movie, id: 27205, title: "Inception" }],
		});

		const response = await answerChat(
			[{ role: "user", content: "Who directed Inception?" }],
			{ llmTimeoutMs: 40 },
		);

		expect(generateOpenAIStream).toHaveBeenCalled();
		expect(response.mode).toBe("local");
		expect(response.results?.[0].title).toBe("Inception");
	});

	it("does not wait on the movie model for a greeting", async () => {
		process.env.AI_API_KEY = "sk-test-key";
		process.env.AI_BASE_URL = "https://api.openai.com/v1";
		const response = await answerChat([{ role: "user", content: "Hey" }]);

		expect(generateOpenAIStream).not.toHaveBeenCalled();
		expect(generateGeminiResponse).not.toHaveBeenCalled();
		expect(response.mode).toBe("local");
		expect(response.reply).toMatch(/hey|mood|genre|plot/i);
	});

	it("follows up on the last recommendations", async () => {
		vi.mocked(fetchSimilar).mockResolvedValue([
			{ ...movie, id: 3, title: "Another Space Movie" },
		]);

		const more = await answerChat([
			{ role: "user", content: "Recommend me a sci-fi movie" },
			{
				role: "assistant",
				content: "Here are popular picks in Science Fiction:",
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
		]);

		expect(fetchSimilar).toHaveBeenCalledWith("movie", "1");
		expect(more.results?.[0].title).toBe("Another Space Movie");

		const first = await answerChat([
			{ role: "user", content: "Recommend me a sci-fi movie" },
			{
				role: "assistant",
				content: "Here are popular picks in Science Fiction:",
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
			{ role: "user", content: "tell me more about the first one" },
		]);

		expect(first.reply).toMatch(/Space Movie/);
		expect(first.results?.[0].id).toBe(1);
		expect(fetchSearchMulti).not.toHaveBeenCalled();
	});

	it("keeps the previous genre when the user adds a decade", async () => {
		vi.mocked(fetchGenres).mockResolvedValue([
			{ id: 878, name: "Science Fiction" },
		]);
		vi.mocked(fetchDiscover).mockResolvedValue({
			page: 1,
			total_pages: 1,
			total_results: 1,
			results: [movie],
		});

		await answerChat([
			{ role: "user", content: "Recommend me a sci-fi movie" },
			{
				role: "assistant",
				content: "Here are popular picks in Science Fiction:",
				results: [
					{
						id: 1,
						media_type: "movie",
						title: "Space Movie",
						poster_path: "/space.jpg",
						release_date: "2026-01-01",
						vote_average: 8,
					},
				],
			},
			{ role: "user", content: "from the 90s" },
		]);

		expect(fetchDiscover).toHaveBeenCalledWith(
			expect.objectContaining({
				genres: ["878"],
				dateFrom: "1990",
				dateTo: "1999",
			}),
		);
	});
});
