import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { fetchSearchMulti } from "@/lib/tmdb";

export async function GET(request: Request) {
	const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
	if (q.length < 2) {
		return NextResponse.json({ results: [] });
	}
	if (q.length > 100) {
		return NextResponse.json({ error: "Query is too long" }, { status: 400 });
	}

	const ip = getClientIp(request.headers);
	const limit = await rateLimit(`suggest:${ip}`, 60, 60_000);
	if (!limit.ok) {
		return NextResponse.json(
			{ error: "Too many requests" },
			{
				status: 429,
				headers: { "Retry-After": String(limit.retryAfterSec) },
			},
		);
	}

	try {
		const data = await fetchSearchMulti(q, 1);
		const results = data.results.slice(0, 6).map(item => ({
			id: item.id,
			media_type: item.media_type ?? "movie",
			title: item.title,
			poster_path: item.poster_path,
			release_date: item.release_date,
		}));
		return NextResponse.json(
			{ results },
			{ headers: { "Cache-Control": "private, max-age=60" } },
		);
	} catch {
		return NextResponse.json({ results: [] }, { status: 200 });
	}
}
