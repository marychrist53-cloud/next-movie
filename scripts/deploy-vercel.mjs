#!/usr/bin/env node
/**
 * Production deploy helper. Reads local .env, never prints secret values,
 * and pushes them to Vercel as encrypted project env vars.
 *
 * Prerequisites: `vercel login` and `turso auth login`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envPath = path.join(root, ".env");

function run(cmd, args, opts = {}) {
	const result = spawnSync(cmd, args, {
		cwd: root,
		encoding: "utf8",
		stdio: opts.silent ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
		...opts,
	});
	if (result.status !== 0 && !opts.allowFail) {
		throw new Error(`${cmd} ${args.join(" ")} failed`);
	}
	return result;
}

function parseEnv(file) {
	const values = {};
	if (!existsSync(file)) return values;
	for (const line of readFileSync(file, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		values[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
	}
	return values;
}

function appendEnv(key, value) {
	appendFileSync(envPath, `\n${key}=${value}\n`);
}

const env = parseEnv(envPath);
const required = [
	"TMDB_TOKEN",
	"CRON_SECRET",
	"OWNER_EMAIL",
	"OWNER_PASSWORD",
	"VAPID_PUBLIC_KEY",
	"VAPID_PRIVATE_KEY",
];
const missing = required.filter(key => !env[key]?.trim());
if (missing.length) {
	console.error(`Missing required keys in .env: ${missing.join(", ")}`);
	process.exit(1);
}

const whoami = run("vercel", ["whoami"], { silent: true, allowFail: true });
if (whoami.status !== 0) {
	console.error("Not logged into Vercel. Run: vercel login");
	process.exit(1);
}

if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
	const auth = run("turso", ["auth", "whoami"], { silent: true, allowFail: true });
	if (auth.status !== 0) {
		console.error("Turso credentials missing and CLI is not logged in. Run: turso auth login");
		process.exit(1);
	}

	const dbName = "next-movie";
	console.log(`Creating Turso database ${dbName} if needed…`);
	run("turso", ["db", "create", dbName], { allowFail: true });

	const urlResult = run("turso", ["db", "show", dbName, "--url"], { silent: true });
	const tokenResult = run("turso", ["db", "tokens", "create", dbName], { silent: true });
	const url = urlResult.stdout.trim();
	const token = tokenResult.stdout.trim();
	if (!url || !token) {
		console.error("Failed to read Turso URL or token.");
		process.exit(1);
	}
	appendEnv("TURSO_DATABASE_URL", url);
	appendEnv("TURSO_AUTH_TOKEN", token);
	env.TURSO_DATABASE_URL = url;
	env.TURSO_AUTH_TOKEN = token;
	console.log("Wrote TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to local .env (not committed).");
}

if (!existsSync(path.join(root, ".vercel", "project.json"))) {
	console.log("Linking Vercel project…");
	const linked = run(
		"vercel",
		["link", "--yes", "--project", "next-movie"],
		{ allowFail: true },
	);
	if (linked.status !== 0) {
		console.error("vercel link failed. Run `vercel link` once interactively.");
		process.exit(1);
	}
}

const vercelVars = [
	"TMDB_TOKEN",
	"AI_API_KEY",
	"AI_BASE_URL",
	"AI_MODEL",
	"GEMINI_API_KEY",
	"GEMINI_MODEL",
	"GEMINI_MODEL_FALLBACK",
	"CRON_SECRET",
	"OWNER_NAME",
	"OWNER_EMAIL",
	"OWNER_PASSWORD",
	"VAPID_PUBLIC_KEY",
	"VAPID_PRIVATE_KEY",
	"VAPID_SUBJECT",
	"TURSO_DATABASE_URL",
	"TURSO_AUTH_TOKEN",
	"TRUST_PROXY_HEADERS",
	"NEXT_PUBLIC_SITE_URL",
];

if (!env.TRUST_PROXY_HEADERS) env.TRUST_PROXY_HEADERS = "1";

const environments = ["production", "preview", "development"];
for (const key of vercelVars) {
	const value = env[key]?.trim();
	if (!value) continue;
	for (const target of environments) {
		const added = spawnSync("vercel", ["env", "add", key, target, "--force", "--yes"], {
			cwd: root,
			encoding: "utf8",
			input: `${value}\n`,
			stdio: ["pipe", "pipe", "pipe"],
		});
		if (added.status !== 0) {
			console.error(`Failed to set ${key} for ${target}`);
			process.exit(1);
		}
	}
	console.log(`Set ${key} on Vercel (production, preview, development).`);
}

console.log("Deploying to production…");
const deploy = spawnSync("vercel", ["--prod", "--yes"], {
	cwd: root,
	encoding: "utf8",
	stdio: ["ignore", "pipe", "inherit"],
});
if (deploy.status !== 0) {
	process.exit(deploy.status ?? 1);
}
const url = deploy.stdout
	.split("\n")
	.map(line => line.trim())
	.find(line => /^https:\/\/.*\.vercel\.app\/?$/.test(line));
if (url) {
	console.log(`Deployed: ${url}`);
	if (!env.NEXT_PUBLIC_SITE_URL) {
		appendEnv("NEXT_PUBLIC_SITE_URL", url.replace(/\/$/, ""));
		console.log("Wrote NEXT_PUBLIC_SITE_URL to local .env. Re-run this script once to publish it.");
	}
} else {
	console.log(deploy.stdout);
}
