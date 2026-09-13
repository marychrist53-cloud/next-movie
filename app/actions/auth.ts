"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import {
	authenticate,
	hashPassword,
	startSession,
	endSession,
	getCurrentUser,
} from "@/lib/auth";
import {
	createUser,
	findUserByEmail,
	updateProfile,
	getSetting,
} from "@/lib/db";
import {
	checkRateLimit,
	clearRateLimit,
	rateLimit,
} from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export type AuthState = { error?: string; ok?: boolean };

async function clientKey(): Promise<string> {
	const h = await headers();
	return getClientIp(h);
}

export async function loginAction(
	_prev: AuthState,
	formData: FormData,
): Promise<AuthState> {
	const email = String(formData.get("email") ?? "").trim().toLowerCase();
	const password = String(formData.get("password") ?? "");

	if (!email || !password) return { error: "Email and password are required." };
	if (email.length > 320 || password.length > 128) {
		return { error: "Invalid email or password." };
	}

	const ip = await clientKey();
	const limit = rateLimit(`login:${ip}`, 10, 60_000);
	if (!limit.ok) {
		return { error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` };
	}

	const lockKey = `${ip}:${email}`;
	const accountLimit = checkRateLimit(`login-account:${lockKey}`, 5);
	if (!accountLimit.ok) {
		const mins = Math.ceil(accountLimit.retryAfterSec / 60);
		return { error: `Account temporarily locked. Try again in ${mins} min.` };
	}

	const result = await authenticate(email, password);
	if ("error" in result) {
		const failed = rateLimit(
			`login-account:${lockKey}`,
			4,
			15 * 60_000,
		);
		if (!failed.ok) {
			return { error: "Account temporarily locked. Try again in 15 min." };
		}
		return { error: result.error };
	}

	const account = findUserByEmail(email);
	if (account?.banned) {
		return { error: "This account has been suspended." };
	}

	clearRateLimit(`login-account:${lockKey}`);
	await startSession(result.id);
	redirect("/");
}

export async function registerAction(
	_prev: AuthState,
	formData: FormData,
): Promise<AuthState> {
	const ip = await clientKey();
	const limit = rateLimit(`register:${ip}`, 3, 10 * 60_000);
	if (!limit.ok) {
		return { error: `Too many signups. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.` };
	}

	const name = String(formData.get("name") ?? "").trim();
	const email = String(formData.get("email") ?? "").trim().toLowerCase();
	const password = String(formData.get("password") ?? "");

	if (getSetting("registrations_open") === "0") {
		return { error: "Registrations are currently closed." };
	}

	if (name.length < 2) return { error: "Name must be at least 2 characters." };
	if (name.length > 60) return { error: "Name is too long." };
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return { error: "Please enter a valid email address." };
	}
	if (email.length > 320) return { error: "Email address is too long." };
	const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
	if (ownerEmail && email === ownerEmail) {
		return { error: "This email is reserved. Sign in with the owner account." };
	}
	if (password.length < 8) {
		return { error: "Password must be at least 8 characters." };
	}
	if (password.length > 128) {
		return { error: "Password must be at most 128 characters." };
	}
	if (findUserByEmail(email)) {
		return { error: "An account with this email already exists." };
	}

	const result = createUser(name, email, hashPassword(password));
	const userId = Number(result.lastInsertRowid);

	await startSession(userId);
	redirect("/");
}

export async function logoutAction() {
	await endSession();
	redirect("/");
}

export async function updateProfileAction(
	_prev: AuthState,
	formData: FormData,
): Promise<AuthState> {
	const user = await getCurrentUser();
	if (!user) return { error: "You must be logged in." };

	const name = String(formData.get("name") ?? "").trim();
	const bio = String(formData.get("bio") ?? "").trim();

	if (name.length < 2 || name.length > 60) {
		return { error: "Name must be 2-60 characters." };
	}

	updateProfile(user.id, name, bio);
	redirect(`/users/${user.id}`);
}
