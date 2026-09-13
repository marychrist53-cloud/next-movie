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

function createTestUser(label: string) {
	const email = `${label}-${crypto.randomUUID()}@example.test`;
	const result = createUser(label, email, "salt:hash");
	return {
		id: Number(result.lastInsertRowid),
		email,
	};
}

describe("database security invariants", () => {
	it("creates public users with the regular user role", () => {
		const user = createTestUser("regular");
		expect(findUserByEmail(user.email)?.role).toBe("user");
	});

	it("enforces a single owner at the database level", () => {
		const first = createTestUser("first-owner");
		const second = createTestUser("second-owner");
		setUserRole(first.id, "owner");
		try {
			expect(() => setUserRole(second.id, "owner")).toThrow();
		} finally {
			setUserRole(first.id, "user");
		}
	});

	it("does not promote a pre-existing account without an owner password", () => {
		const user = createTestUser("reserved-owner");
		const previousEmail = process.env.OWNER_EMAIL;
		const previousPassword = process.env.OWNER_PASSWORD;
		try {
			process.env.OWNER_EMAIL = user.email;
			delete process.env.OWNER_PASSWORD;
			bootstrapOwnerFromEnv();
			expect(findUserByEmail(user.email)?.role).toBe("user");
		} finally {
			if (previousEmail === undefined) delete process.env.OWNER_EMAIL;
			else process.env.OWNER_EMAIL = previousEmail;
			if (previousPassword === undefined) delete process.env.OWNER_PASSWORD;
			else process.env.OWNER_PASSWORD = previousPassword;
		}
	});

	it("scopes push subscription deletion to its owner", () => {
		const owner = createTestUser("push-owner");
		const other = createTestUser("push-other");
		const endpoint = `https://push.example.test/${crypto.randomUUID()}`;

		addPushSubscription(owner.id, endpoint, "p256dh", "auth");
		removePushSubscription(other.id, endpoint);
		expect(getPushSubscriptions(owner.id)).toHaveLength(1);

		removePushSubscription(owner.id, endpoint);
		expect(getPushSubscriptions(owner.id)).toHaveLength(0);
	});

	it("does not transfer a push endpoint between users", () => {
		const owner = createTestUser("endpoint-owner");
		const other = createTestUser("endpoint-other");
		const endpoint = `https://push.example.test/${crypto.randomUUID()}`;

		addPushSubscription(owner.id, endpoint, "owner-key", "owner-auth");
		const result = addPushSubscription(
			other.id,
			endpoint,
			"other-key",
			"other-auth",
		);

		expect(Number(result.changes)).toBe(0);
		expect(getPushSubscriptions(owner.id)).toHaveLength(1);
		expect(getPushSubscriptions(other.id)).toHaveLength(0);
	});
});
