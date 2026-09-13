import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
	getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
	addPushSubscription: vi.fn(),
	removePushSubscription: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth";
import {
	addPushSubscription,
	removePushSubscription,
} from "@/lib/db";
import {
	DELETE,
	POST,
} from "@/app/api/push/subscribe/route";

const mockedUser = vi.mocked(getCurrentUser);
const mockedAdd = vi.mocked(addPushSubscription);
const mockedRemove = vi.mocked(removePushSubscription);

function request(method: string, body: unknown) {
	return new Request("http://localhost/api/push/subscribe", {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("push subscription route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("requires authentication to unsubscribe", async () => {
		mockedUser.mockResolvedValue(null);
		const response = await DELETE(request("DELETE", { endpoint: "https://push.test/1" }));
		expect(response.status).toBe(401);
		expect(mockedRemove).not.toHaveBeenCalled();
	});

	it("only removes the current user's endpoint", async () => {
		mockedUser.mockResolvedValue({ id: 7, name: "Mary", email: "mary@example.com" });
		const response = await DELETE(request("DELETE", { endpoint: "https://push.test/1" }));
		expect(response.status).toBe(200);
		expect(mockedRemove).toHaveBeenCalledWith(7, "https://push.test/1");
	});

	it("rejects incomplete subscriptions", async () => {
		mockedUser.mockResolvedValue({ id: 7, name: "Mary", email: "mary@example.com" });
		const response = await POST(request("POST", { endpoint: "https://push.test/1" }));
		expect(response.status).toBe(400);
		expect(mockedAdd).not.toHaveBeenCalled();
	});

	it("rejects an endpoint already owned by another account", async () => {
		mockedUser.mockResolvedValue({ id: 7, name: "Mary", email: "mary@example.com" });
		mockedAdd.mockResolvedValue({ changes: 0, lastInsertRowid: 0 });
		const response = await POST(
			request("POST", {
				endpoint: "https://push.test/1",
				keys: { p256dh: "key", auth: "auth" },
			}),
		);
		expect(response.status).toBe(409);
	});
});
