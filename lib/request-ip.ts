import { isIP } from "node:net";

type HeaderReader = Pick<Headers, "get">;

export function getClientIp(headers: HeaderReader): string {
	if (process.env.TRUST_PROXY_HEADERS !== "1") return "shared";

	const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	const candidates = [
		headers.get("cf-connecting-ip")?.trim(),
		headers.get("x-real-ip")?.trim(),
		forwarded,
	];
	for (const candidate of candidates) {
		if (candidate && candidate.length <= 45 && isIP(candidate)) return candidate;
	}
	return "shared";
}
