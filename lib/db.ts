import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import {
	getSqliteDriver,
	type RunResult,
	type SqliteDriver,
} from "@/lib/sqlite-driver";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  poster_path TEXT,
  release_date TEXT,
  vote_average REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, media_type, media_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  poster_path TEXT,
  release_date TEXT,
  vote_average REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, media_type, media_id)
);

CREATE TABLE IF NOT EXISTS ratings (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, media_type, media_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notify_subs (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, media_type, media_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  due_date TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, media_type, media_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_comments_media ON comments (media_type, media_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, read_at);

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

async function ensureColumn(
	driver: SqliteDriver,
	table: string,
	column: string,
	definition: string,
) {
	const columns = (await driver.all<{ name: string }>(
		`PRAGMA table_info(${table})`,
	)) as { name: string }[];
	if (!columns.some(item => item.name === column)) {
		await driver.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
	}
}

async function provisionOwner(driver: SqliteDriver) {
	const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
	if (!email) return;

	const name = process.env.OWNER_NAME?.trim() || "Owner";
	const password = process.env.OWNER_PASSWORD;
	const existing = await driver.get<{
		id: number;
		name: string;
		email: string;
		password_hash: string;
		role: string;
		banned: number;
	}>("SELECT id, name, email, password_hash, role, banned FROM users WHERE email = ?", [
		email,
	]);

	if (!existing && !password) {
		console.warn(
			`[owner] OWNER_EMAIL=${email} not found and OWNER_PASSWORD not set — account not created`,
		);
		return;
	}
	if (existing?.role !== "owner" && !password) {
		console.warn(
			`[owner] OWNER_EMAIL=${email} belongs to a non-owner account and OWNER_PASSWORD is not set — account not promoted`,
		);
		return;
	}

	await driver.transaction(async tx => {
		if (existing) {
			await tx.run(
				"UPDATE users SET role = 'admin' WHERE role = 'owner' AND id <> ?",
				[existing.id],
			);

			const [salt, storedHash] = existing.password_hash.split(":");
			const passwordMatches =
				!!password &&
				!!salt &&
				!!storedHash &&
				(() => {
					const candidate = scryptSync(password, salt, 64);
					const expected = Buffer.from(storedHash, "hex");
					return (
						candidate.length === expected.length &&
						timingSafeEqual(candidate, expected)
					);
				})();

			if (password && !passwordMatches) {
				const nextSalt = randomBytes(16).toString("hex");
				const hash = `${nextSalt}:${scryptSync(password, nextSalt, 64).toString("hex")}`;
				await tx.run(
					"UPDATE users SET role = 'owner', banned = 0, password_hash = ? WHERE id = ?",
					[hash, existing.id],
				);
			} else {
				await tx.run("UPDATE users SET role = 'owner', banned = 0 WHERE id = ?", [
					existing.id,
				]);
			}
		} else {
			await tx.run("UPDATE users SET role = 'admin' WHERE role = 'owner'");
			const salt = randomBytes(16).toString("hex");
			const hash = `${salt}:${scryptSync(password!, salt, 64).toString("hex")}`;
			const result = await tx.run(
				"INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'owner')",
				[name, email, hash],
			);
			console.log(
				`[owner] created owner account ${email} (id ${result.lastInsertRowid})`,
			);
		}
	});
}

async function migrate(driver: SqliteDriver) {
	await driver.exec(SCHEMA);
	await ensureColumn(driver, "users", "role", "TEXT NOT NULL DEFAULT 'user'");
	await ensureColumn(driver, "users", "bio", "TEXT NOT NULL DEFAULT ''");
	await ensureColumn(
		driver,
		"comments",
		"parent_id",
		"INTEGER REFERENCES comments(id) ON DELETE CASCADE",
	);
	await ensureColumn(driver, "users", "banned", "INTEGER NOT NULL DEFAULT 0");
	await driver.exec(
		"CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id);",
	);
	await driver.exec(
		"CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit_buckets (reset_at);",
	);
	await driver.exec(
		"CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);",
	);
	await provisionOwner(driver);
	await driver.exec(
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_owner ON users(role) WHERE role = 'owner';",
	);
}

let ready: Promise<SqliteDriver> | null = null;

async function readyDriver(): Promise<SqliteDriver> {
	if (!ready) {
		ready = (async () => {
			const driver = await getSqliteDriver();
			await migrate(driver);
			return driver;
		})();
	}
	return ready;
}

const db = {
	async exec(sql: string) {
		await (await readyDriver()).exec(sql);
	},
	prepare(sql: string) {
		return {
			get: async (...params: unknown[]) =>
				(await readyDriver()).get(sql, params),
			all: async (...params: unknown[]) =>
				(await readyDriver()).all(sql, params),
			run: async (...params: unknown[]): Promise<RunResult> =>
				(await readyDriver()).run(sql, params),
		};
	},
};

export async function bootstrapOwnerFromEnv() {
	await provisionOwner(await readyDriver());
}

function plain<T>(row: T): T {
	return Array.isArray(row)
		? (row.map(item => ({ ...item })) as T)
		: ({ ...row } as T);
}

export type LibraryRow = {
	user_id: number;
	media_type: string;
	media_id: number;
	title: string;
	poster_path: string | null;
	release_date: string | null;
	vote_average: number;
};

export type CommentRow = {
	id: number;
	body: string;
	created_at: string;
	user_id: number;
	author: string;
};

export type NotificationRow = {
	id: number;
	media_type: string;
	media_id: number;
	kind: string;
	title: string;
	message: string;
	due_date: string | null;
	read_at: string | null;
	created_at: string;
};

/* ------------------------------- users ----------------------------------- */

export async function findUserByEmail(email: string) {
	const row = await db
		.prepare(
			"SELECT id, name, email, password_hash, role, banned FROM users WHERE email = ?",
		)
		.get(email.toLowerCase()) as
		| {
				id: number;
				name: string;
				email: string;
				password_hash: string;
				role: string;
				banned: number;
		  }
		| undefined;
	return row ? plain(row) : undefined;
}

export async function createUser(name: string, email: string, passwordHash: string) {
	return db
		.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
		.run(name, email.toLowerCase(), passwordHash);
}

/* ------------------------------ sessions --------------------------------- */

export async function createSession(token: string, userId: number, expiresAt: string) {
	await db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
		token,
		userId,
		expiresAt,
	);
}

export async function findSessionUser(token: string) {
	const row = await db
		.prepare(
			`SELECT u.id, u.name, u.email FROM sessions s
			 JOIN users u ON u.id = s.user_id
			 WHERE s.token = ? AND s.expires_at > datetime('now') AND u.banned = 0`,
		)
		.get(token) as { id: number; name: string; email: string } | undefined;
	return row ? plain(row) : undefined;
}

export async function deleteSession(token: string) {
	await db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export async function deleteExpiredSessions() {
	await db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
}

/* ------------------------- watchlist / favorites -------------------------- */

async function libraryRows(table: string, userId: number){
	return plain(
		await db
			.prepare(
				`SELECT user_id, media_type, media_id, title, poster_path, release_date, vote_average
				 FROM ${table} WHERE user_id = ? ORDER BY created_at DESC`,
			)
			.all(userId),
	) as LibraryRow[];
}

async function libraryHas(table: string, userId: number, mediaType: string, mediaId: number) {
	return Boolean(await db
		.prepare(
			`SELECT 1 FROM ${table} WHERE user_id = ? AND media_type = ? AND media_id = ?`,
		)
		.get(userId, mediaType, mediaId));
}

async function libraryInsert(
	table: string,
	userId: number,
	item: {
		media_type: string;
		media_id: number;
		title: string;
		poster_path: string | null;
		release_date: string | null;
		vote_average: number;
	},
) {
	await db.prepare(
		`INSERT OR IGNORE INTO ${table}
		 (user_id, media_type, media_id, title, poster_path, release_date, vote_average)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(
		userId,
		item.media_type,
		item.media_id,
		item.title,
		item.poster_path,
		item.release_date,
		item.vote_average,
	);
}

async function libraryDelete(table: string, userId: number, mediaType: string, mediaId: number) {
	await db.prepare(
		`DELETE FROM ${table} WHERE user_id = ? AND media_type = ? AND media_id = ?`,
	).run(userId, mediaType, mediaId);
}

export const getWatchlist = async (userId: number) => libraryRows("watchlist_items", userId);
export const isWatchlisted = async (userId: number, mediaType: string, mediaId: number) =>
	libraryHas("watchlist_items", userId, mediaType, mediaId);
export const addWatchlist = async (userId: number, item: Parameters<typeof libraryInsert>[2]) =>
	libraryInsert("watchlist_items", userId, item);
export const removeWatchlist = async (userId: number, mediaType: string, mediaId: number) =>
	libraryDelete("watchlist_items", userId, mediaType, mediaId);

export const getFavorites = async (userId: number) => libraryRows("favorites", userId);
export const isFavorite = async (userId: number, mediaType: string, mediaId: number) =>
	libraryHas("favorites", userId, mediaType, mediaId);
export const addFavorite = async (userId: number, item: Parameters<typeof libraryInsert>[2]) =>
	libraryInsert("favorites", userId, item);
export const removeFavorite = async (userId: number, mediaType: string, mediaId: number) =>
	libraryDelete("favorites", userId, mediaType, mediaId);

export async function getWatchlistIds(userId: number){
	return (
		plain(
			await db
				.prepare("SELECT media_type || '-' || media_id AS key FROM watchlist_items WHERE user_id = ?")
				.all(userId),
		) as { key: string }[]
	).map(r => r.key);
}

export async function getFavoriteIds(userId: number){
	return (
		plain(
			await db
				.prepare("SELECT media_type || '-' || media_id AS key FROM favorites WHERE user_id = ?")
				.all(userId),
		) as { key: string }[]
	).map(r => r.key);
}

/* -------------------------------- ratings --------------------------------- */

export async function getRating(userId: number, mediaType: string, mediaId: number){
	const row = await db
		.prepare("SELECT rating FROM ratings WHERE user_id = ? AND media_type = ? AND media_id = ?")
		.get(userId, mediaType, mediaId) as { rating: number } | undefined;
	return row?.rating ?? null;
}

export async function setRating(userId: number, mediaType: string, mediaId: number, rating: number) {
	await db.prepare(
		`INSERT INTO ratings (user_id, media_type, media_id, rating) VALUES (?, ?, ?, ?)
		 ON CONFLICT (user_id, media_type, media_id) DO UPDATE SET rating = excluded.rating, updated_at = datetime('now')`,
	).run(userId, mediaType, mediaId, rating);
}

export async function deleteRating(userId: number, mediaType: string, mediaId: number) {
	await db.prepare("DELETE FROM ratings WHERE user_id = ? AND media_type = ? AND media_id = ?").run(
		userId,
		mediaType,
		mediaId,
	);
}

export async function importRatings(
	userId: number,
	items: { mediaType: string; id: number; rating: number }[],
) {
	const stmt = await db.prepare(
		`INSERT INTO ratings (user_id, media_type, media_id, rating) VALUES (?, ?, ?, ?)
		 ON CONFLICT (user_id, media_type, media_id) DO UPDATE SET rating = excluded.rating`,
	);
	for (const item of items) {
		if (item.rating >= 1 && item.rating <= 10) {
			await stmt.run(userId, item.mediaType, item.id, Math.round(item.rating));
		}
	}
}

/* -------------------------------- comments -------------------------------- */

export async function getComments(mediaType: string, mediaId: number){
	return plain(
		await db
			.prepare(
				`SELECT c.id, c.body, c.created_at, c.user_id, u.name AS author
				 FROM comments c JOIN users u ON u.id = c.user_id
				 WHERE c.media_type = ? AND c.media_id = ? AND c.parent_id IS NULL
				 ORDER BY c.created_at DESC`,
			)
			.all(mediaType, mediaId),
	) as CommentRow[];
}

export async function addComment(
	userId: number,
	mediaType: string,
	mediaId: number,
	body: string,
	parentId: number | null = null,
) {
	return db
		.prepare(
			"INSERT INTO comments (user_id, media_type, media_id, body, parent_id) VALUES (?, ?, ?, ?, ?)",
		)
		.run(userId, mediaType, mediaId, body, parentId);
}

export async function getCommentContext(commentId: number) {
	const row = await db
		.prepare("SELECT media_type, media_id FROM comments WHERE id = ?")
		.get(commentId) as
		| { media_type: string; media_id: number }
		| undefined;
	return row ? plain(row) : undefined;
}

export async function deleteComment(userId: number, commentId: number) {
	await db.prepare("DELETE FROM comments WHERE id = ? AND user_id = ?").run(commentId, userId);
}

/* ----------------------------- notifications ------------------------------ */

export async function getNotifySubs(userId: number) {
	return plain(
		await db
			.prepare("SELECT media_type, media_id, title FROM notify_subs WHERE user_id = ?")
			.all(userId),
	) as { media_type: string; media_id: number; title: string }[];
}

export async function isSubscribed(userId: number, mediaType: string, mediaId: number) {
	return Boolean(await db
		.prepare("SELECT 1 FROM notify_subs WHERE user_id = ? AND media_type = ? AND media_id = ?")
		.get(userId, mediaType, mediaId));
}

export async function addNotifySub(userId: number, mediaType: string, mediaId: number, title: string) {
	await db.prepare(
		"INSERT OR IGNORE INTO notify_subs (user_id, media_type, media_id, title) VALUES (?, ?, ?, ?)",
	).run(userId, mediaType, mediaId, title);
}

export async function removeNotifySub(userId: number, mediaType: string, mediaId: number) {
	await db.prepare("DELETE FROM notify_subs WHERE user_id = ? AND media_type = ? AND media_id = ?").run(
		userId,
		mediaType,
		mediaId,
	);
}

export async function upsertNotification(input: {
	userId: number;
	mediaType: string;
	mediaId: number;
	kind: string;
	title: string;
	message: string;
	dueDate: string | null;
}){
	const result = await db
		.prepare(
			`INSERT INTO notifications (user_id, media_type, media_id, kind, title, message, due_date)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (user_id, media_type, media_id, kind) DO NOTHING`,
		)
		.run(
			input.userId,
			input.mediaType,
			input.mediaId,
			input.kind,
			input.title,
			input.message,
			input.dueDate,
		);
	return Number(result.changes) > 0;
}

export async function getNotifications(userId: number){
	return plain(
		await db
			.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100")
			.all(userId),
	) as NotificationRow[];
}

export async function getUnreadCount(userId: number){
	const row = await db
		.prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL")
		.get(userId) as { c: number };
	return Number(row.c);
}

export async function markAllNotificationsRead(userId: number) {
	await db.prepare(
		"UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL",
	).run(userId);
}

/* -------------------------------- profiles -------------------------------- */

export type ProfileRow = {
	id: number;
	name: string;
	email: string;
	bio: string;
	role: string;
	banned: number;
	created_at: string;
};

export async function getUserProfile(userId: number){
	const row = await db
		.prepare("SELECT id, name, email, bio, role, banned, created_at FROM users WHERE id = ?")
		.get(userId) as ProfileRow | undefined;
	return row ? plain(row) : undefined;
}

export async function updateProfile(userId: number, name: string, bio: string) {
	await db.prepare("UPDATE users SET name = ?, bio = ? WHERE id = ?").run(
		name,
		bio.slice(0, 500),
		userId,
	);
}

export async function getUserRole(userId: number){
	const row = await db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as
		| { role: string }
		| undefined;
	return row?.role ?? "user";
}

export async function setUserRole(userId: number, role: "owner" | "admin" | "user") {
	await db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
}

export type AdminUserRow = {
	id: number;
	name: string;
	email: string;
	role: string;
	banned: number;
	created_at: string;
};

export async function getAllUsers(){
	return plain(
		await db
			.prepare(
				"SELECT id, name, email, role, banned, created_at FROM users ORDER BY created_at ASC",
			)
			.all(),
	) as AdminUserRow[];
}

export async function isBanned(userId: number){
	const row = await db.prepare("SELECT banned FROM users WHERE id = ?").get(userId) as
		| { banned: number }
		| undefined;
	return !!row?.banned;
}

export async function setBanned(userId: number, banned: boolean) {
	await db.prepare("UPDATE users SET banned = ? WHERE id = ?").run(banned ? 1 : 0, userId);
	if (banned) {
		await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
	}
}

export async function getSiteStats() {
	const count = async (sql: string) =>
		Number(((await db.prepare(sql).get()) as { c: number }).c);
	return {
		users: await count("SELECT COUNT(*) AS c FROM users"),
		comments: await count("SELECT COUNT(*) AS c FROM comments"),
		ratings: await count("SELECT COUNT(*) AS c FROM ratings"),
		watchlist: await count("SELECT COUNT(*) AS c FROM watchlist_items"),
		favorites: await count("SELECT COUNT(*) AS c FROM favorites"),
		notifySubs: await count("SELECT COUNT(*) AS c FROM notify_subs"),
		notifications: await count("SELECT COUNT(*) AS c FROM notifications"),
	};
}

export async function countUsers(){
	const row = await db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
	return Number(row.c);
}

export async function countComments(){
	const row = await db.prepare("SELECT COUNT(*) AS c FROM comments").get() as { c: number };
	return Number(row.c);
}

export async function countRatings(){
	const row = await db.prepare("SELECT COUNT(*) AS c FROM ratings").get() as { c: number };
	return Number(row.c);
}

export async function countRatingsForUser(userId: number){
	const row = await db
		.prepare("SELECT COUNT(*) AS c FROM ratings WHERE user_id = ?")
		.get(userId) as { c: number };
	return Number(row.c);
}

export async function getAllComments(limit = 30){
	return plain(
		await db
			.prepare(
				`SELECT c.id, c.body, c.created_at, c.user_id, u.name AS author
				 FROM comments c JOIN users u ON u.id = c.user_id
				 ORDER BY c.created_at DESC LIMIT ?`,
			)
			.all(limit),
	) as CommentRow[];
}

export async function adminDeleteComment(commentId: number) {
	await db.prepare("DELETE FROM comments WHERE id = ?").run(commentId);
}

/* -------------------------- comment replies & likes ----------------------- */

export async function getCommentLikes(commentIds: number[], userId: number | null) {
	if (!commentIds.length) return { counts: {}, likedByMe: new Set<number>() };
	const placeholders = commentIds.map(() => "?").join(",");
	const countRows = plain(
		await db
			.prepare(
				`SELECT comment_id, COUNT(*) AS c FROM comment_likes
				 WHERE comment_id IN (${placeholders}) GROUP BY comment_id`,
			)
			.all(...commentIds),
	) as { comment_id: number; c: number }[];

	const counts: Record<number, number> = {};
	for (const row of countRows) counts[row.comment_id] = row.c;

	const likedByMe = new Set<number>();
	if (userId) {
		const liked = plain(
			await db
				.prepare(
					`SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${placeholders})`,
				)
				.all(userId, ...commentIds),
		) as { comment_id: number }[];
		for (const row of liked) likedByMe.add(row.comment_id);
	}

	return { counts, likedByMe };
}

export async function toggleCommentLike(commentId: number, userId: number){
	const existing = await db
		.prepare("SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?")
		.get(commentId, userId);
	if (existing) {
		await db.prepare("DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?").run(
			commentId,
			userId,
		);
		return false;
	}
	await db.prepare("INSERT OR IGNORE INTO comment_likes (comment_id, user_id) VALUES (?, ?)").run(
		commentId,
		userId,
	);
	return true;
}

export async function getReplies(parentIds: number[]){
	const map = new Map<number, CommentRow[]>();
	if (!parentIds.length) return map;
	const placeholders = parentIds.map(() => "?").join(",");
	const rows = plain(
		await db
			.prepare(
				`SELECT c.id, c.body, c.created_at, c.user_id, c.parent_id, u.name AS author
				 FROM comments c JOIN users u ON u.id = c.user_id
				 WHERE c.parent_id IN (${placeholders})
				 ORDER BY c.created_at ASC`,
			)
			.all(...parentIds),
	) as (CommentRow & { parent_id: number })[];

	for (const row of rows) {
		const { parent_id, ...comment } = row;
		const list = map.get(parent_id) ?? [];
		list.push(comment);
		map.set(parent_id, list);
	}
	return map;
}

/* ------------------------------- settings --------------------------------- */

export async function getSetting(key: string){
	const row = await db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
		| { value: string }
		| undefined;
	return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
	await db.prepare(
		`INSERT INTO settings (key, value) VALUES (?, ?)
		 ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
	).run(key, value);
}

/* ------------------------------ rate limits ------------------------------- */

export async function consumeRateLimit(key: string, windowMs: number) {
	const now = Date.now();
	const resetAt = now + windowMs;
	await db.prepare(
		`INSERT INTO rate_limit_buckets (key, count, reset_at) VALUES (?, 1, ?)
		 ON CONFLICT (key) DO UPDATE SET
		   count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
		   reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END`,
	).run(key, resetAt, now, now, resetAt);

	return getRateLimitBucket(key);
}

export async function getRateLimitBucket(key: string) {
	const row = await db
		.prepare("SELECT count, reset_at FROM rate_limit_buckets WHERE key = ?")
		.get(key) as { count: number; reset_at: number } | undefined;
	if (!row || row.reset_at <= Date.now()) return undefined;
	return plain(row);
}

export async function clearRateLimit(key: string) {
	await db.prepare("DELETE FROM rate_limit_buckets WHERE key = ?").run(key);
}

export async function pruneExpiredRateLimits() {
	await db.prepare("DELETE FROM rate_limit_buckets WHERE reset_at <= ?").run(Date.now());
}

/* ---------------------------- push subscriptions -------------------------- */

export type PushSubRow = {
	id: number;
	endpoint: string;
	p256dh: string;
	auth: string;
};

export async function addPushSubscription(userId: number, endpoint: string, p256dh: string, auth: string) {
	return await db.prepare(
		`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
		 ON CONFLICT (endpoint) DO UPDATE SET
		   p256dh = excluded.p256dh,
		   auth = excluded.auth
		 WHERE push_subscriptions.user_id = excluded.user_id`,
	).run(userId, endpoint, p256dh, auth);
}

export async function removePushSubscription(userId: number, endpoint: string) {
	await db.prepare(
		"DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
	).run(userId, endpoint);
}

export async function getPushSubscriptions(userId: number){
	return plain(
		await db.prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?").all(
			userId,
		),
	) as PushSubRow[];
}

export async function prunePushSubscription(endpoint: string) {
	await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

export async function getAllNotifySubUsers(){
	return (
		plain(await db.prepare("SELECT DISTINCT user_id AS id FROM notify_subs").all()) as {
			id: number;
		}[]
	).map(r => r.id);
}

