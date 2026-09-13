import { createHmac } from "node:crypto";

function sessionSecret(): string {
	const secret = process.env.SESSION_SECRET?.trim();
	if (secret) return secret;
	if (process.env.VERCEL || process.env.NODE_ENV === "production") {
		throw new Error("SESSION_SECRET is required in production");
	}
	return "dev-session-secret";
}

export function hashSessionToken(token: string): string {
	return createHmac("sha256", sessionSecret()).update(token).digest("hex");
}
