import path from "node:path";
import { tmpdir } from "node:os";

process.env.DATABASE_PATH = path.join(
	tmpdir(),
	`next-movie-tests-${process.pid}-${Date.now()}.db`,
);
delete process.env.OWNER_EMAIL;
delete process.env.OWNER_PASSWORD;
delete process.env.GEMINI_API_KEY;
delete process.env.GEMINI_MODEL;
delete process.env.GEMINI_MODEL_FALLBACK;
delete process.env.TRUST_PROXY_HEADERS;
