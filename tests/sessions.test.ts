import { describe, expect, it } from "vitest";

import { hashSessionToken } from "@/lib/session-token";
import {
	createSession,
	createUser,
	deleteSessionsForUser,
	findSessionUser,
} from "@/lib/db";

async function createTestUser(label: string) {
	const email = `${label}-${crypto.randomUUID()}@example.test`;
	const result = await createUser(label, email, "salt:hash");
	return Number(result.lastInsertRowid);
}

describe("hashed sessions", () => {
	it("looks up users by HMAC of the raw cookie token", async () => {
		const userId = await createTestUser("session");
		const raw = `raw-token-${crypto.randomUUID()}`;
		const expires = new Date(Date.now() + 60_000)
			.toISOString()
			.replace("T", " ")
			.slice(0, 19);

		await createSession(hashSessionToken(raw), userId, expires);

		expect(await findSessionUser(raw)).toBeUndefined();
		expect(await findSessionUser(hashSessionToken(raw))).toMatchObject({
			id: userId,
		});
	});

	it("invalidates every session for a user", async () => {
		const userId = await createTestUser("logout-all");
		const first = hashSessionToken(`first-${crypto.randomUUID()}`);
		const second = hashSessionToken(`second-${crypto.randomUUID()}`);
		const expires = new Date(Date.now() + 60_000)
			.toISOString()
			.replace("T", " ")
			.slice(0, 19);

		await createSession(first, userId, expires);
		await createSession(second, userId, expires);
		await deleteSessionsForUser(userId);

		expect(await findSessionUser(first)).toBeUndefined();
		expect(await findSessionUser(second)).toBeUndefined();
	});
});
