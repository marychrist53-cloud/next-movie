import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
	createSession,
	deleteExpiredSessions,
	deleteSession,
	findSessionUser,
	findUserByEmail,
} from "@/lib/db";

const SESSION_COOKIE = "nm-session";
const SESSION_DAYS = 30;

export type SessionUser = { id: number; name: string; email: string };

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString("hex");
	const hash = scryptSync(password, salt, 64).toString("hex");
	return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(":");
	if (!salt || !hash) return false;
	const candidate = scryptSync(password, salt, 64);
	const expected = Buffer.from(hash, "hex");
	return (
		candidate.length === expected.length && timingSafeEqual(candidate, expected)
	);
}

export async function startSession(userId: number) {
	const token = randomBytes(32).toString("hex");
	const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
		.toISOString()
		.replace("T", " ")
		.slice(0, 19);

	createSession(token, userId, expires);
	deleteExpiredSessions();

	const store = await cookies();
	store.set(SESSION_COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		expires: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
		path: "/",
	});
}

export async function endSession() {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	if (token) {
		deleteSession(token);
		store.delete(SESSION_COOKIE);
	}
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	if (!token) return null;

	try {
		return findSessionUser(token) ?? null;
	} catch {
		return null;
	}
});

export async function requireUser(): Promise<SessionUser> {
	const user = await getCurrentUser();
	if (!user) redirect("/login");
	return user;
}

export function isStaff(user: SessionUser | null, role: string | undefined): boolean {
	return !!user && (role === "admin" || role === "owner");
}

export function isOwnerRole(role: string | undefined): boolean {
	return role === "owner";
}

export async function authenticate(
	email: string,
	password: string,
): Promise<{ id: number } | { error: string }> {
	const user = findUserByEmail(email);
	if (!user || !verifyPassword(password, user.password_hash)) {
		return { error: "Invalid email or password." };
	}
	return { id: user.id };
}
