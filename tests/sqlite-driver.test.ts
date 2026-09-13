import { afterEach, describe, expect, it } from "vitest";

import { getSqliteDriver, resetSqliteDriverForTests } from "@/lib/sqlite-driver";

describe("sqlite driver", () => {
	afterEach(() => {
		delete process.env.VERCEL;
		delete process.env.TURSO_DATABASE_URL;
		delete process.env.TURSO_AUTH_TOKEN;
		resetSqliteDriverForTests();
	});

	it("fails closed on Vercel without Turso", async () => {
		process.env.VERCEL = "1";
		delete process.env.TURSO_DATABASE_URL;
		delete process.env.TURSO_AUTH_TOKEN;
		resetSqliteDriverForTests();

		await expect(getSqliteDriver()).rejects.toThrow(
			"TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required on Vercel",
		);
	});
});
