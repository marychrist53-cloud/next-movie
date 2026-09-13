import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
	getAllNotifySubUsers: vi.fn(),
}));
vi.mock("@/lib/notify", () => ({
	refreshNotificationsForUser: vi.fn(),
}));

import { GET } from "@/app/api/cron/notifications/route";
import { getAllNotifySubUsers } from "@/lib/db";
import { refreshNotificationsForUser } from "@/lib/notify";

const mockedUsers = vi.mocked(getAllNotifySubUsers);
const mockedRefresh = vi.mocked(refreshNotificationsForUser);
const originalSecret = process.env.CRON_SECRET;

describe("notification cron route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedUsers.mockResolvedValue([]);
	});

	afterEach(() => {
		if (originalSecret === undefined) delete process.env.CRON_SECRET;
		else process.env.CRON_SECRET = originalSecret;
	});

	it("fails closed when CRON_SECRET is missing", async () => {
		delete process.env.CRON_SECRET;
		const response = await GET(new Request("http://localhost/api/cron/notifications"));
		expect(response.status).toBe(503);
		expect(mockedUsers).not.toHaveBeenCalled();
	});

	it("rejects an invalid secret", async () => {
		process.env.CRON_SECRET = "correct-secret";
		const response = await GET(
			new Request("http://localhost/api/cron/notifications?secret=wrong"),
		);
		expect(response.status).toBe(401);
	});

	it("refreshes subscribed users with a valid bearer token", async () => {
		process.env.CRON_SECRET = "correct-secret";
		mockedUsers.mockResolvedValue([2, 4]);
		mockedRefresh.mockResolvedValue(undefined);

		const response = await GET(
			new Request("http://localhost/api/cron/notifications", {
				headers: { Authorization: "Bearer correct-secret" },
			}),
		);
		expect(response.status).toBe(200);
		expect(mockedRefresh).toHaveBeenCalledTimes(2);
		expect(await response.json()).toMatchObject({
			ok: true,
			usersChecked: 2,
			usersFailed: 0,
		});
	});
});
