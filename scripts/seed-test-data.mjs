import { randomBytes, scryptSync } from "node:crypto";

import db from "../lib/db.ts";

const MIGRATION_ID = "2026-09-06-seed-20-users-40-comments-v1";
const TEST_EMAIL_DOMAIN = "example.test";
const USER_COUNT = 20;
const COMMENT_COUNT = 40;

if (process.env.NODE_ENV === "production" && process.env.ALLOW_TEST_SEED !== "1") {
	throw new Error(
		"Refusing to seed test data in production. Set ALLOW_TEST_SEED=1 only if intentional.",
	);
}

const alreadyApplied = db
	.prepare("SELECT 1 FROM schema_migrations WHERE id = ?")
	.get(MIGRATION_ID);

if (alreadyApplied) {
	console.log(`Migration ${MIGRATION_ID} is already applied; no data was duplicated.`);
	process.exit(0);
}

const password = process.env.SEED_TEST_PASSWORD || "TestUser123!";
const salt = randomBytes(16).toString("hex");
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;

const titles = [
	{ mediaType: "movie", mediaId: 550, title: "Fight Club" },
	{ mediaType: "movie", mediaId: 13, title: "Forrest Gump" },
	{ mediaType: "movie", mediaId: 680, title: "Pulp Fiction" },
	{ mediaType: "movie", mediaId: 155, title: "The Dark Knight" },
	{ mediaType: "movie", mediaId: 27205, title: "Inception" },
	{ mediaType: "movie", mediaId: 157336, title: "Interstellar" },
	{ mediaType: "movie", mediaId: 238, title: "The Godfather" },
	{ mediaType: "movie", mediaId: 603, title: "The Matrix" },
	{ mediaType: "tv", mediaId: 1396, title: "Breaking Bad" },
	{ mediaType: "tv", mediaId: 66732, title: "Stranger Things" },
];

const rootMessages = [
	"The performances made this one memorable for me.",
	"I liked the pacing and would happily watch it again.",
	"The cinematography is easily the strongest part.",
	"A solid recommendation for a weekend watch.",
	"The ending gave me a lot to think about.",
	"The soundtrack fits the story perfectly.",
	"I enjoyed the characters more than I expected.",
	"This has held up surprisingly well over time.",
	"The opening pulled me in immediately.",
	"I understand why this title is so highly rated.",
];

const replyMessages = [
	"I agree, especially about the performances.",
	"That was my favorite part too.",
	"Good point—the second half really delivers.",
	"I had the same reaction after watching it.",
	"The soundtrack deserves more attention.",
	"I would recommend it for the same reason.",
	"The character development worked well for me.",
	"That scene completely changed the tone.",
	"I noticed that on my second viewing.",
	"Thanks for sharing—I see it differently now.",
];

function createdAt(minutesAgo) {
	return new Date(Date.now() - minutesAgo * 60_000)
		.toISOString()
		.replace("T", " ")
		.slice(0, 19);
}

db.exec("BEGIN IMMEDIATE");
try {
	const insertUser = db.prepare(
		`INSERT INTO users (name, email, password_hash, role, bio, banned)
		 VALUES (?, ?, ?, 'user', ?, 0)
		 ON CONFLICT(email) DO NOTHING`,
	);

	for (let index = 1; index <= USER_COUNT; index += 1) {
		const number = String(index).padStart(2, "0");
		insertUser.run(
			`Test User ${number}`,
			`testuser${number}@${TEST_EMAIL_DOMAIN}`,
			passwordHash,
			"Seeded account for local development and UI testing.",
		);
	}

	const users = db
		.prepare(
			`SELECT id, email FROM users
			 WHERE email LIKE ?
			 ORDER BY email
			 LIMIT ?`,
		)
		.all(`testuser%@${TEST_EMAIL_DOMAIN}`, USER_COUNT);

	if (users.length !== USER_COUNT) {
		throw new Error(`Expected ${USER_COUNT} seeded users, found ${users.length}.`);
	}

	const insertComment = db.prepare(
		`INSERT INTO comments
		   (user_id, media_type, media_id, body, parent_id, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
	);

	const rootIds = [];
	for (let index = 0; index < 30; index += 1) {
		const user = users[index % users.length];
		const title = titles[index % titles.length];
		const result = insertComment.run(
			user.id,
			title.mediaType,
			title.mediaId,
			rootMessages[index % rootMessages.length],
			null,
			createdAt(COMMENT_COUNT - index),
		);
		rootIds.push({
			id: Number(result.lastInsertRowid),
			title,
		});
	}

	for (let index = 0; index < 10; index += 1) {
		const user = users[(index + 10) % users.length];
		const root = rootIds[index * 3];
		insertComment.run(
			user.id,
			root.title.mediaType,
			root.title.mediaId,
			replyMessages[index],
			root.id,
			createdAt(10 - index),
		);
	}

	db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(MIGRATION_ID);
	db.exec("COMMIT");
} catch (error) {
	db.exec("ROLLBACK");
	throw error;
}

const userTotal = db
	.prepare("SELECT COUNT(*) AS count FROM users WHERE email LIKE ?")
	.get(`testuser%@${TEST_EMAIL_DOMAIN}`).count;
const commentTotal = db
	.prepare(
		`SELECT COUNT(*) AS count
		 FROM comments c
		 JOIN users u ON u.id = c.user_id
		 WHERE u.email LIKE ?`,
	)
	.get(`testuser%@${TEST_EMAIL_DOMAIN}`).count;

if (userTotal !== USER_COUNT || commentTotal !== COMMENT_COUNT) {
	throw new Error(
		`Seed verification failed: ${userTotal} users and ${commentTotal} comments.`,
	);
}

console.log(`Seeded ${userTotal} test users and ${commentTotal} comments.`);
console.log(`Accounts: testuser01@${TEST_EMAIL_DOMAIN} through testuser20@${TEST_EMAIL_DOMAIN}`);
console.log("Use SEED_TEST_PASSWORD to override the development seed password.");
