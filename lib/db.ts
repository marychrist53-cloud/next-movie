import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DATABASE_PATH =
	process.env.DATABASE_PATH?.trim() ||
	path.join(process.cwd(), "data", "nextmovie.db");
mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

const db = new DatabaseSync(DATABASE_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 5000;");

db.exec(`
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
`);

function ensureColumn(table: string, column: string, definition: string) {
	const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
		name: string;
	}[];
	if (!columns.some(item => item.name === column)) {
		db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
	}
}

ensureColumn("users", "role", "TEXT NOT NULL DEFAULT 'user'");
ensureColumn("users", "bio", "TEXT NOT NULL DEFAULT ''");
ensureColumn(
	"comments",
	"parent_id",
	"INTEGER REFERENCES comments(id) ON DELETE CASCADE",
);
ensureColumn("users", "banned", "INTEGER NOT NULL DEFAULT 0");

db.exec("CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id);");
db.exec(
	"CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit_buckets (reset_at);",
);
db.exec(
	"CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);",
);

export function bootstrapOwnerFromEnv() {
	const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
	if (!email) return;

	const name = process.env.OWNER_NAME?.trim() || "Owner";
	const password = process.env.OWNER_PASSWORD;
	const existing = findUserByEmail(email);

	if (!existing && !password) {
		console.warn(`[owner] OWNER_EMAIL=${email} not found and OWNER_PASSWORD not set — account not created`);
		return;
	}
	if (existing?.role !== "owner" && !password) {
		console.warn(
			`[owner] OWNER_EMAIL=${email} belongs to a non-owner account and OWNER_PASSWORD is not set — account not promoted`,
		);
		return;
	}

	db.exec("BEGIN IMMEDIATE");
	try {
		if (existing) {
			db.prepare(
				"UPDATE users SET role = 'admin' WHERE role = 'owner' AND id <> ?",
			).run(existing.id);

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
				db.prepare(
					"UPDATE users SET role = 'owner', banned = 0, password_hash = ? WHERE id = ?",
				).run(hash, existing.id);
			} else {
				db.prepare(
					"UPDATE users SET role = 'owner', banned = 0 WHERE id = ?",
				).run(existing.id);
			}
		} else {
			db.prepare("UPDATE users SET role = 'admin' WHERE role = 'owner'").run();
			const salt = randomBytes(16).toString("hex");
			const hash = `${salt}:${scryptSync(password!, salt, 64).toString("hex")}`;
			const result = db
				.prepare(
					"INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'owner')",
				)
				.run(name, email, hash);
			console.log(
				`[owner] created owner account ${email} (id ${result.lastInsertRowid})`,
			);
		}
		db.exec("COMMIT");
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	}
}

bootstrapOwnerFromEnv();
db.exec(
	"CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_owner ON users(role) WHERE role = 'owner';",
);

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

export function findUserByEmail(email: string) {
	const row = db
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

export function createUser(name: string, email: string, passwordHash: string) {
	return db
		.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
		.run(name, email.toLowerCase(), passwordHash);
}

/* ------------------------------ sessions --------------------------------- */

export function createSession(token: string, userId: number, expiresAt: string) {
	db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
		token,
		userId,
		expiresAt,
	);
}

export function findSessionUser(token: string) {
	const row = db
		.prepare(
			`SELECT u.id, u.name, u.email FROM sessions s
			 JOIN users u ON u.id = s.user_id
			 WHERE s.token = ? AND s.expires_at > datetime('now') AND u.banned = 0`,
		)
		.get(token) as { id: number; name: string; email: string } | undefined;
	return row ? plain(row) : undefined;
}

export function deleteSession(token: string) {
	db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function deleteExpiredSessions() {
	db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
}

/* ------------------------- watchlist / favorites -------------------------- */

function libraryRows(table: string, userId: number): LibraryRow[] {
	return plain(
		db
			.prepare(
				`SELECT user_id, media_type, media_id, title, poster_path, release_date, vote_average
				 FROM ${table} WHERE user_id = ? ORDER BY created_at DESC`,
			)
			.all(userId),
	) as LibraryRow[];
}

function libraryHas(table: string, userId: number, mediaType: string, mediaId: number) {
	return !!db
		.prepare(
			`SELECT 1 FROM ${table} WHERE user_id = ? AND media_type = ? AND media_id = ?`,
		)
		.get(userId, mediaType, mediaId);
}

function libraryInsert(
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
	db.prepare(
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

function libraryDelete(table: string, userId: number, mediaType: string, mediaId: number) {
	db.prepare(
		`DELETE FROM ${table} WHERE user_id = ? AND media_type = ? AND media_id = ?`,
	).run(userId, mediaType, mediaId);
}

export const getWatchlist = (userId: number) => libraryRows("watchlist_items", userId);
export const isWatchlisted = (userId: number, mediaType: string, mediaId: number) =>
	libraryHas("watchlist_items", userId, mediaType, mediaId);
export const addWatchlist = (userId: number, item: Parameters<typeof libraryInsert>[2]) =>
	libraryInsert("watchlist_items", userId, item);
export const removeWatchlist = (userId: number, mediaType: string, mediaId: number) =>
	libraryDelete("watchlist_items", userId, mediaType, mediaId);

export const getFavorites = (userId: number) => libraryRows("favorites", userId);
export const isFavorite = (userId: number, mediaType: string, mediaId: number) =>
	libraryHas("favorites", userId, mediaType, mediaId);
export const addFavorite = (userId: number, item: Parameters<typeof libraryInsert>[2]) =>
	libraryInsert("favorites", userId, item);
export const removeFavorite = (userId: number, mediaType: string, mediaId: number) =>
	libraryDelete("favorites", userId, mediaType, mediaId);

export function getWatchlistIds(userId: number): string[] {
	return (
		plain(
			db
				.prepare("SELECT media_type || '-' || media_id AS key FROM watchlist_items WHERE user_id = ?")
				.all(userId),
		) as { key: string }[]
	).map(r => r.key);
}

export function getFavoriteIds(userId: number): string[] {
	return (
		plain(
			db
				.prepare("SELECT media_type || '-' || media_id AS key FROM favorites WHERE user_id = ?")
				.all(userId),
		) as { key: string }[]
	).map(r => r.key);
}

/* -------------------------------- ratings --------------------------------- */

export function getRating(userId: number, mediaType: string, mediaId: number): number | null {
	const row = db
		.prepare("SELECT rating FROM ratings WHERE user_id = ? AND media_type = ? AND media_id = ?")
		.get(userId, mediaType, mediaId) as { rating: number } | undefined;
	return row?.rating ?? null;
}

export function setRating(userId: number, mediaType: string, mediaId: number, rating: number) {
	db.prepare(
		`INSERT INTO ratings (user_id, media_type, media_id, rating) VALUES (?, ?, ?, ?)
		 ON CONFLICT (user_id, media_type, media_id) DO UPDATE SET rating = excluded.rating, updated_at = datetime('now')`,
	).run(userId, mediaType, mediaId, rating);
}

export function deleteRating(userId: number, mediaType: string, mediaId: number) {
	db.prepare("DELETE FROM ratings WHERE user_id = ? AND media_type = ? AND media_id = ?").run(
		userId,
		mediaType,
		mediaId,
	);
}

export function importRatings(
	userId: number,
	items: { mediaType: string; id: number; rating: number }[],
) {
	const stmt = db.prepare(
		`INSERT INTO ratings (user_id, media_type, media_id, rating) VALUES (?, ?, ?, ?)
		 ON CONFLICT (user_id, media_type, media_id) DO UPDATE SET rating = excluded.rating`,
	);
	for (const item of items) {
		if (item.rating >= 1 && item.rating <= 10) {
			stmt.run(userId, item.mediaType, item.id, Math.round(item.rating));
		}
	}
}

/* -------------------------------- comments -------------------------------- */

export function getComments(mediaType: string, mediaId: number): CommentRow[] {
	return plain(
		db
			.prepare(
				`SELECT c.id, c.body, c.created_at, c.user_id, u.name AS author
				 FROM comments c JOIN users u ON u.id = c.user_id
				 WHERE c.media_type = ? AND c.media_id = ? AND c.parent_id IS NULL
				 ORDER BY c.created_at DESC`,
			)
			.all(mediaType, mediaId),
	) as CommentRow[];
}

export function addComment(
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

export function getCommentContext(commentId: number) {
	const row = db
		.prepare("SELECT media_type, media_id FROM comments WHERE id = ?")
		.get(commentId) as
		| { media_type: string; media_id: number }
		| undefined;
	return row ? plain(row) : undefined;
}

export function deleteComment(userId: number, commentId: number) {
	db.prepare("DELETE FROM comments WHERE id = ? AND user_id = ?").run(commentId, userId);
}

/* ----------------------------- notifications ------------------------------ */

export function getNotifySubs(userId: number) {
	return plain(
		db
			.prepare("SELECT media_type, media_id, title FROM notify_subs WHERE user_id = ?")
			.all(userId),
	) as { media_type: string; media_id: number; title: string }[];
}

export function isSubscribed(userId: number, mediaType: string, mediaId: number) {
	return !!db
		.prepare("SELECT 1 FROM notify_subs WHERE user_id = ? AND media_type = ? AND media_id = ?")
		.get(userId, mediaType, mediaId);
}

export function addNotifySub(userId: number, mediaType: string, mediaId: number, title: string) {
	db.prepare(
		"INSERT OR IGNORE INTO notify_subs (user_id, media_type, media_id, title) VALUES (?, ?, ?, ?)",
	).run(userId, mediaType, mediaId, title);
}

export function removeNotifySub(userId: number, mediaType: string, mediaId: number) {
	db.prepare("DELETE FROM notify_subs WHERE user_id = ? AND media_type = ? AND media_id = ?").run(
		userId,
		mediaType,
		mediaId,
	);
}

export function upsertNotification(input: {
	userId: number;
	mediaType: string;
	mediaId: number;
	kind: string;
	title: string;
	message: string;
	dueDate: string | null;
}): boolean {
	const result = db
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

export function getNotifications(userId: number): NotificationRow[] {
	return plain(
		db
			.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100")
			.all(userId),
	) as NotificationRow[];
}

export function getUnreadCount(userId: number): number {
	const row = db
		.prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL")
		.get(userId) as { c: number };
	return Number(row.c);
}

export function markAllNotificationsRead(userId: number) {
	db.prepare(
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

export function getUserProfile(userId: number): ProfileRow | undefined {
	const row = db
		.prepare("SELECT id, name, email, bio, role, banned, created_at FROM users WHERE id = ?")
		.get(userId) as ProfileRow | undefined;
	return row ? plain(row) : undefined;
}

export function updateProfile(userId: number, name: string, bio: string) {
	db.prepare("UPDATE users SET name = ?, bio = ? WHERE id = ?").run(
		name,
		bio.slice(0, 500),
		userId,
	);
}

export function getUserRole(userId: number): string {
	const row = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as
		| { role: string }
		| undefined;
	return row?.role ?? "user";
}

export function setUserRole(userId: number, role: "owner" | "admin" | "user") {
	db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
}

export type AdminUserRow = {
	id: number;
	name: string;
	email: string;
	role: string;
	banned: number;
	created_at: string;
};

export function getAllUsers(): AdminUserRow[] {
	return plain(
		db
			.prepare(
				"SELECT id, name, email, role, banned, created_at FROM users ORDER BY created_at ASC",
			)
			.all(),
	) as AdminUserRow[];
}

export function isBanned(userId: number): boolean {
	const row = db.prepare("SELECT banned FROM users WHERE id = ?").get(userId) as
		| { banned: number }
		| undefined;
	return !!row?.banned;
}

export function setBanned(userId: number, banned: boolean) {
	db.prepare("UPDATE users SET banned = ? WHERE id = ?").run(banned ? 1 : 0, userId);
	if (banned) {
		db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
	}
}

export function getSiteStats() {
	const count = (sql: string) =>
		Number((db.prepare(sql).get() as { c: number }).c);
	return {
		users: count("SELECT COUNT(*) AS c FROM users"),
		comments: count("SELECT COUNT(*) AS c FROM comments"),
		ratings: count("SELECT COUNT(*) AS c FROM ratings"),
		watchlist: count("SELECT COUNT(*) AS c FROM watchlist_items"),
		favorites: count("SELECT COUNT(*) AS c FROM favorites"),
		notifySubs: count("SELECT COUNT(*) AS c FROM notify_subs"),
		notifications: count("SELECT COUNT(*) AS c FROM notifications"),
	};
}

export function countUsers(): number {
	const row = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
	return Number(row.c);
}

export function countComments(): number {
	const row = db.prepare("SELECT COUNT(*) AS c FROM comments").get() as { c: number };
	return Number(row.c);
}

export function countRatings(): number {
	const row = db.prepare("SELECT COUNT(*) AS c FROM ratings").get() as { c: number };
	return Number(row.c);
}

export function countRatingsForUser(userId: number): number {
	const row = db
		.prepare("SELECT COUNT(*) AS c FROM ratings WHERE user_id = ?")
		.get(userId) as { c: number };
	return Number(row.c);
}

export function getAllComments(limit = 30): CommentRow[] {
	return plain(
		db
			.prepare(
				`SELECT c.id, c.body, c.created_at, c.user_id, u.name AS author
				 FROM comments c JOIN users u ON u.id = c.user_id
				 ORDER BY c.created_at DESC LIMIT ?`,
			)
			.all(limit),
	) as CommentRow[];
}

export function adminDeleteComment(commentId: number) {
	db.prepare("DELETE FROM comments WHERE id = ?").run(commentId);
}

/* -------------------------- comment replies & likes ----------------------- */

export function getCommentLikes(commentIds: number[], userId: number | null) {
	if (!commentIds.length) return { counts: {}, likedByMe: new Set<number>() };
	const placeholders = commentIds.map(() => "?").join(",");
	const countRows = plain(
		db
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
			db
				.prepare(
					`SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${placeholders})`,
				)
				.all(userId, ...commentIds),
		) as { comment_id: number }[];
		for (const row of liked) likedByMe.add(row.comment_id);
	}

	return { counts, likedByMe };
}

export function toggleCommentLike(commentId: number, userId: number): boolean {
	const existing = db
		.prepare("SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?")
		.get(commentId, userId);
	if (existing) {
		db.prepare("DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?").run(
			commentId,
			userId,
		);
		return false;
	}
	db.prepare("INSERT OR IGNORE INTO comment_likes (comment_id, user_id) VALUES (?, ?)").run(
		commentId,
		userId,
	);
	return true;
}

export function getReplies(parentIds: number[]): Map<number, CommentRow[]> {
	const map = new Map<number, CommentRow[]>();
	if (!parentIds.length) return map;
	const placeholders = parentIds.map(() => "?").join(",");
	const rows = plain(
		db
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

export function getSetting(key: string): string | null {
	const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
		| { value: string }
		| undefined;
	return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
	db.prepare(
		`INSERT INTO settings (key, value) VALUES (?, ?)
		 ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
	).run(key, value);
}

/* ------------------------------ rate limits ------------------------------- */

export function consumeRateLimit(key: string, windowMs: number) {
	const now = Date.now();
	const resetAt = now + windowMs;
	db.prepare(
		`INSERT INTO rate_limit_buckets (key, count, reset_at) VALUES (?, 1, ?)
		 ON CONFLICT (key) DO UPDATE SET
		   count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
		   reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END`,
	).run(key, resetAt, now, now, resetAt);

	return getRateLimitBucket(key);
}

export function getRateLimitBucket(key: string) {
	const row = db
		.prepare("SELECT count, reset_at FROM rate_limit_buckets WHERE key = ?")
		.get(key) as { count: number; reset_at: number } | undefined;
	if (!row || row.reset_at <= Date.now()) return undefined;
	return plain(row);
}

export function clearRateLimit(key: string) {
	db.prepare("DELETE FROM rate_limit_buckets WHERE key = ?").run(key);
}

export function pruneExpiredRateLimits() {
	db.prepare("DELETE FROM rate_limit_buckets WHERE reset_at <= ?").run(Date.now());
}

/* ---------------------------- push subscriptions -------------------------- */

export type PushSubRow = {
	id: number;
	endpoint: string;
	p256dh: string;
	auth: string;
};

export function addPushSubscription(userId: number, endpoint: string, p256dh: string, auth: string) {
	return db.prepare(
		`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
		 ON CONFLICT (endpoint) DO UPDATE SET
		   p256dh = excluded.p256dh,
		   auth = excluded.auth
		 WHERE push_subscriptions.user_id = excluded.user_id`,
	).run(userId, endpoint, p256dh, auth);
}

export function removePushSubscription(userId: number, endpoint: string) {
	db.prepare(
		"DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
	).run(userId, endpoint);
}

export function getPushSubscriptions(userId: number): PushSubRow[] {
	return plain(
		db.prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?").all(
			userId,
		),
	) as PushSubRow[];
}

export function prunePushSubscription(endpoint: string) {
	db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

export function getAllNotifySubUsers(): number[] {
	return (
		plain(db.prepare("SELECT DISTINCT user_id AS id FROM notify_subs").all()) as {
			id: number;
		}[]
	).map(r => r.id);
}

export default db;
