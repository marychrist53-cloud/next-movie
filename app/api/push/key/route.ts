import { NextResponse } from "next/server";

import { getVapidKeys } from "@/lib/notify";

export async function GET() {
	try {
		const { publicKey } = getVapidKeys();
		return NextResponse.json({ publicKey });
	} catch {
		return NextResponse.json({ error: "Push not configured" }, { status: 503 });
	}
}
