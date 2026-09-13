import { createClient, type Client, type InValue } from "@libsql/client";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export type RunResult = {
	changes: number;
	lastInsertRowid: number;
};

export type SqliteDriver = {
	exec(sql: string): Promise<void>;
	get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
	all<T>(sql: string, params?: unknown[]): Promise<T[]>;
	run(sql: string, params?: unknown[]): Promise<RunResult>;
	transaction<T>(fn: (tx: SqliteDriver) => Promise<T>): Promise<T>;
};

function asArgs(params: unknown[]): InValue[] {
	return params as InValue[];
}

function normalize(value: unknown): unknown {
	if (typeof value === "bigint") return Number(value);
	if (Array.isArray(value)) return value.map(normalize);
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value)) {
			out[key] = normalize(item);
		}
		return out;
	}
	return value;
}

function createLocalDriver(filePath: string): SqliteDriver {
	mkdirSync(path.dirname(filePath), { recursive: true });
	const db = new DatabaseSync(filePath);
	db.exec("PRAGMA journal_mode = WAL;");
	db.exec("PRAGMA foreign_keys = ON;");
	db.exec("PRAGMA busy_timeout = 5000;");

	const driver: SqliteDriver = {
		async exec(sql: string) {
			db.exec(sql);
		},
		async get<T>(sql: string, params: unknown[] = []) {
			return normalize(db.prepare(sql).get(...(params as never[]))) as T | undefined;
		},
		async all<T>(sql: string, params: unknown[] = []) {
			return normalize(db.prepare(sql).all(...(params as never[]))) as T[];
		},
		async run(sql: string, params: unknown[] = []) {
			const result = db.prepare(sql).run(...(params as never[]));
			return {
				changes: Number(result.changes ?? 0),
				lastInsertRowid: Number(result.lastInsertRowid ?? 0),
			};
		},
		async transaction(fn) {
			db.exec("BEGIN IMMEDIATE");
			try {
				const value = await fn(driver);
				db.exec("COMMIT");
				return value;
			} catch (error) {
				db.exec("ROLLBACK");
				throw error;
			}
		},
	};
	return driver;
}

function wrapLibsql(
	execute: (sql: string, params?: unknown[]) => Promise<{
		rows: unknown[];
		rowsAffected: number;
		lastInsertRowid: bigint | number | undefined;
	}>,
	executeMultiple: (sql: string) => Promise<void>,
	transaction?: SqliteDriver["transaction"],
): SqliteDriver {
	const driver: SqliteDriver = {
		async exec(sql: string) {
			await executeMultiple(sql);
		},
		async get<T>(sql: string, params: unknown[] = []) {
			const result = await execute(sql, params);
			return normalize(result.rows[0]) as T | undefined;
		},
		async all<T>(sql: string, params: unknown[] = []) {
			const result = await execute(sql, params);
			return normalize(result.rows) as T[];
		},
		async run(sql: string, params: unknown[] = []) {
			const result = await execute(sql, params);
			return {
				changes: Number(result.rowsAffected ?? 0),
				lastInsertRowid: Number(result.lastInsertRowid ?? 0),
			};
		},
		async transaction(fn) {
			if (!transaction) {
				throw new Error("Nested Turso transactions are not supported");
			}
			return transaction(fn);
		},
	};
	return driver;
}

function createTursoDriver(url: string, authToken: string): SqliteDriver {
	const client: Client = createClient({ url, authToken });

	const execute = async (sql: string, params: unknown[] = []) => {
		const result = await client.execute({ sql, args: asArgs(params) });
		return {
			rows: result.rows as unknown[],
			rowsAffected: result.rowsAffected,
			lastInsertRowid: result.lastInsertRowid,
		};
	};

	return wrapLibsql(
		execute,
		async sql => {
			await client.executeMultiple(sql);
		},
		async fn => {
			const tx = await client.transaction("write");
			const txDriver = wrapLibsql(
				async (sql, params = []) => {
					const result = await tx.execute({ sql, args: asArgs(params) });
					return {
						rows: result.rows as unknown[],
						rowsAffected: result.rowsAffected,
						lastInsertRowid: result.lastInsertRowid,
					};
				},
				async sql => {
					await tx.execute(sql);
				},
			);
			try {
				const value = await fn(txDriver);
				await tx.commit();
				return value;
			} catch (error) {
				await tx.rollback();
				throw error;
			}
		},
	);
}

let driverPromise: Promise<SqliteDriver> | null = null;

export function getSqliteDriver(): Promise<SqliteDriver> {
	if (!driverPromise) driverPromise = openDriver();
	return driverPromise;
}

async function openDriver(): Promise<SqliteDriver> {
	const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
	const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();

	if (tursoUrl) {
		if (!tursoToken) {
			throw new Error(
				"TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing",
			);
		}
		return createTursoDriver(tursoUrl, tursoToken);
	}

	if (process.env.VERCEL) {
		console.warn(
			"[db] TURSO_DATABASE_URL is not set; using ephemeral /tmp SQLite. Accounts, sessions, and rate limits will not persist across instances.",
		);
		return createLocalDriver(path.join("/tmp", "nextmovie.db"));
	}

	const filePath =
		process.env.DATABASE_PATH?.trim() ||
		path.join(process.cwd(), "data", "nextmovie.db");
	return createLocalDriver(filePath);
}

export function resetSqliteDriverForTests() {
	driverPromise = null;
}
