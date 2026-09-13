import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { addPushSubscription, removePushSubscription } from "@/lib/db";

export async function POST(request: Request) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const body = (await request.json()) as {
			endpoint?: string;
			keys?: { p256dh?: string; auth?: string };
		};

		if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
			return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
		}
		if (
			body.endpoint.length > 2048 ||
			body.keys.p256dh.length > 512 ||
			body.keys.auth.length > 512
		) {
			return NextResponse.json({ error: "Subscription is too large" }, { status: 400 });
		}

		const result = addPushSubscription(
			user.id,
			body.endpoint,
			body.keys.p256dh,
			body.keys.auth,
		);
		if (Number(result.changes) === 0) {
			return NextResponse.json(
				{ error: "Subscription belongs to another account" },
				{ status: 409 },
			);
		}
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}

export async function DELETE(request: Request) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const body = (await request.json()) as { endpoint?: string };
		if (!body.endpoint || body.endpoint.length > 2048) {
			return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
		}
		removePushSubscription(user.id, body.endpoint);
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}
