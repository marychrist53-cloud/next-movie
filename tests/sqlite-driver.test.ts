import { describe, expect, it } from "vitest";

import { hostedDatabaseError } from "@/lib/sqlite-driver";

describe("sqlite driver", () => {
	it("fails closed on Vercel without Turso", () => {
		expect(
			hostedDatabaseError({
				VERCEL: "1",
			}),
		).toBe("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required on Vercel");
	});

	it("requires a Turso token when a Turso URL is set", () => {
		expect(
			hostedDatabaseError({
				TURSO_DATABASE_URL: "libsql://example.turso.io",
			}),
		).toBe("TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing");
	});
});
