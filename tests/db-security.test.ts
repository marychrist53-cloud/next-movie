import { describe, expect, it } from "vitest";

import {
	addPushSubscription,
	bootstrapOwnerFromEnv,
	createUser,
	findUserByEmail,
	getPushSubscriptions,
	removePushSubscription,
	setUserRole,
} from "@/lib/db";

async function createTestUser(label: string) {
	const email = `${label}-${crypto.randomUUID()}@example.test`;
	const result = await createUser(label, email, "salt:hash");
	return {
		id: Number(result.lastInsertRowid),
		email,
	};
}

describe("database security invariants", () => {
	it("creates public users with the regular user role", async () => {
		const user = await createTestUser("regular");
		expect((await findUserByEmail(user.email))?.role).toBe("user");
	});

	it("enforces a single owner at the database level", async () => {
		const first = await createTestUser("first-owner");
		const second = await createTestUser("second-owner");
		await setUserRole(first.id, "owner");
		try {
			await expect(setUserRole(second.id, "owner")).rejects.toThrow();
		} finally {
			await setUserRole(first.id, "user");
		}
	});

	it("does not promote a pre-existing account without an owner password", async () => {
		const user = await createTestUser("reserved-owner");
		const previousEmail = process.env.OWNER_EMAIL;
		const previousPassword = process.env.OWNER_PASSWORD;
		try {
			process.env.OWNER_EMAIL = user.email;
			delete process.env.OWNER_PASSWORD;
			await bootstrapOwnerFromEnv();
			expect((await findUserByEmail(user.email))?.role).toBe("user");
		} finally {
			if (previousEmail === undefined) delete process.env.OWNER_EMAIL;
			else process.env.OWNER_EMAIL = previousEmail;
			if (previousPassword === undefined) delete process.env.OWNER_PASSWORD;
			else process.env.OWNER_PASSWORD = previousPassword;
		}
	});

	it("scopes push subscription deletion to its owner", async () => {
		const owner = await createTestUser("push-owner");
		const other = await createTestUser("push-other");
		const endpoint = `https://push.example.test/${crypto.randomUUID()}`;

		await addPushSubscription(owner.id, endpoint, "p256dh", "auth");
		await removePushSubscription(other.id, endpoint);
		expect(await getPushSubscriptions(owner.id)).toHaveLength(1);

		await removePushSubscription(owner.id, endpoint);
		expect(await getPushSubscriptions(owner.id)).toHaveLength(0);
	});

	it("does not transfer a push endpoint between users", async () => {
		const owner = await createTestUser("endpoint-owner");
		const other = await createTestUser("endpoint-other");
		const endpoint = `https://push.example.test/${crypto.randomUUID()}`;

		await addPushSubscription(owner.id, endpoint, "owner-key", "owner-auth");
		const result = await addPushSubscription(
			other.id,
			endpoint,
			"other-key",
			"other-auth",
		);

		expect(Number(result.changes)).toBe(0);
		expect(await getPushSubscriptions(owner.id)).toHaveLength(1);
		expect(await getPushSubscriptions(other.id)).toHaveLength(0);
	});
});
