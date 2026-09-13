import { NextResponse } from "next/server";

import { answerChat, type ChatMessage } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export async function POST(request: Request) {
	const contentLength = Number(request.headers.get("content-length") ?? 0);
	if (contentLength > 32_000) {
		return NextResponse.json({ error: "Request is too large" }, { status: 413 });
	}

	const ip = getClientIp(request.headers);

	const limit = rateLimit(`chat:${ip}`, 20, 60_000);
	if (!limit.ok) {
		return NextResponse.json(
			{ error: `Rate limit reached — try again in ${limit.retryAfterSec}s.` },
			{ status: 429 },
		);
	}

	let messages: ChatMessage[];
	try {
		const rawBody = await request.text();
		if (rawBody.length > 32_000) {
			return NextResponse.json({ error: "Request is too large" }, { status: 413 });
		}
		const body = JSON.parse(rawBody) as { messages?: unknown };
		if (!Array.isArray(body.messages)) {
			return NextResponse.json({ error: "Invalid body" }, { status: 400 });
		}
		messages = body.messages
			.filter(
				(m): m is ChatMessage =>
					typeof m === "object" &&
					m !== null &&
					["user", "assistant"].includes((m as ChatMessage).role) &&
					typeof (m as ChatMessage).content === "string",
			)
			.slice(-12)
			.map(m => ({
				role: m.role === "assistant" ? "assistant" : "user",
				content: String(m.content).slice(0, 2000),
				results: Array.isArray(m.results)
					? m.results
							.filter(
								item =>
									item &&
									typeof item === "object" &&
									typeof item.id === "number" &&
									typeof item.title === "string" &&
									(item.media_type === "movie" || item.media_type === "tv"),
							)
							.slice(0, 8)
							.map(item => ({
								id: item.id,
								media_type: item.media_type,
								title: String(item.title).slice(0, 160),
								poster_path:
									typeof item.poster_path === "string" ? item.poster_path : null,
								release_date:
									typeof item.release_date === "string" ? item.release_date : null,
								vote_average:
									typeof item.vote_average === "number" ? item.vote_average : 0,
								overview:
									typeof item.overview === "string"
										? item.overview.slice(0, 280)
										: undefined,
							}))
					: undefined,
			}));
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	if (!messages.length || messages[messages.length - 1].role !== "user") {
		return NextResponse.json({ error: "No user message" }, { status: 400 });
	}

	try {
		const response = await answerChat(messages);
		return NextResponse.json(response, {
			headers: { "Cache-Control": "no-store" },
		});
	} catch (error) {
		console.error("[chat] assistant failed", error);
		return NextResponse.json(
			{ error: "The assistant is unavailable right now." },
			{ status: 503 },
		);
	}
}
