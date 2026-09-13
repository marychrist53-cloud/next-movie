import { describe, expect, it } from "vitest";

import { formatDateShort } from "@/lib/format";

describe("formatDateShort", () => {
	it("formats SQLite UTC timestamps", () => {
		expect(formatDateShort("2026-09-06 12:30:00")).toBe("Sep 6, 2026");
	});

	it("formats ISO timestamps without appending a second timezone", () => {
		expect(formatDateShort("2026-09-06T12:30:00Z")).toBe("Sep 6, 2026");
		expect(formatDateShort("2026-09-06T12:30:00+06:30")).toBe("Sep 6, 2026");
	});

	it("handles invalid values", () => {
		expect(formatDateShort("not-a-date")).toBe("Unknown date");
	});
});
