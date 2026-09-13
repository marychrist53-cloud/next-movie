import { afterEach, describe, expect, it } from "vitest";

import { getClientIp } from "@/lib/request-ip";

describe("getClientIp", () => {
	afterEach(() => {
		delete process.env.TRUST_PROXY_HEADERS;
	});

	it("ignores spoofable forwarded headers unless the proxy is trusted", () => {
		const headers = new Headers({ "x-forwarded-for": "203.0.113.5" });
		expect(getClientIp(headers)).toBe("shared");
	});

	it("accepts a validated address from a trusted proxy", () => {
		process.env.TRUST_PROXY_HEADERS = "1";
		const headers = new Headers({
			"x-forwarded-for": "203.0.113.5, 10.0.0.1",
		});
		expect(getClientIp(headers)).toBe("203.0.113.5");
	});

	it("rejects malformed forwarded values", () => {
		process.env.TRUST_PROXY_HEADERS = "1";
		const headers = new Headers({ "x-real-ip": "attacker-controlled" });
		expect(getClientIp(headers)).toBe("shared");
	});
});
