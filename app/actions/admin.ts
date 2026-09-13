"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import {
	getAllNotifySubUsers,
	getUserProfile,
	setBanned,
	setSetting,
	setUserRole,
} from "@/lib/db";
import { refreshNotificationsForUser } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";

export type AdminState = { error?: string; ok?: boolean };

async function requireOwnerRole() {
	const actor = await requireUser();
	const profile = await getUserProfile(actor.id);
	if (profile?.role !== "owner") return null;
	return actor;
}

export async function setUserRoleAction(
	targetUserId: number,
	role: "admin" | "user",
): Promise<AdminState> {
	const actor = await requireUser();
	const actorProfile = await getUserProfile(actor.id);

	if (actorProfile?.role !== "owner") {
		return { error: "Only the owner can manage roles." };
	}

	const target = await getUserProfile(targetUserId);
	if (!target) return { error: "User not found." };

	if (target.role === "owner") {
		return { error: "The owner account cannot be modified." };
	}

	if (targetUserId === actor.id) {
		return { error: "You cannot change your own role." };
	}

	if (role !== "admin" && role !== "user") {
		return { error: "Invalid role." };
	}

	await setUserRole(targetUserId, role);
	revalidatePath("/admin");
	return { ok: true };
}

export async function setUserRoleFormAction(formData: FormData): Promise<void> {
	const targetUserId = Number(formData.get("userId"));
	const role = String(formData.get("role")) as "admin" | "user";
	if (!Number.isInteger(targetUserId) || targetUserId <= 0) return;
	await setUserRoleAction(targetUserId, role);
}

export async function setBannedAction(
	targetUserId: number,
	banned: boolean,
): Promise<AdminState> {
	const actor = await requireOwnerRole();
	if (!actor) return { error: "Only the owner can manage bans." };

	const target = await getUserProfile(targetUserId);
	if (!target) return { error: "User not found." };
	if (target.role === "owner") return { error: "The owner cannot be banned." };
	if (targetUserId === actor.id) return { error: "You cannot ban yourself." };

	await setBanned(targetUserId, banned);
	revalidatePath("/admin");
	return { ok: true };
}

export async function setBannedFormAction(formData: FormData): Promise<void> {
	const targetUserId = Number(formData.get("userId"));
	const banned = String(formData.get("banned")) === "1";
	if (!Number.isInteger(targetUserId) || targetUserId <= 0) return;
	await setBannedAction(targetUserId, banned);
}

export async function setRegistrationsAction(open: boolean): Promise<AdminState> {
	const actor = await requireOwnerRole();
	if (!actor) return { error: "Only the owner can change settings." };

	await setSetting("registrations_open", open ? "1" : "0");
	revalidatePath("/admin");
	revalidatePath("/register");
	return { ok: true };
}

export async function setRegistrationsFormAction(formData: FormData): Promise<void> {
	await setRegistrationsAction(String(formData.get("open")) === "1");
}

export async function setAnnouncementAction(
	_prev: AdminState,
	formData: FormData,
): Promise<AdminState> {
	const actor = await requireOwnerRole();
	if (!actor) return { error: "Only the owner can change settings." };

	const text = String(formData.get("announcement") ?? "").trim();
	await setSetting("announcement", text.slice(0, 300));
	revalidatePath("/", "layout");
	return { ok: true };
}

export async function refreshAllNotificationsFormAction(): Promise<void> {
	const actor = await requireUser();
	const profile = await getUserProfile(actor.id);
	if (profile?.role !== "owner" && profile?.role !== "admin") return;
	const limit = await rateLimit(
		"admin-notification-refresh",
		1,
		5 * 60_000,
	);
	if (!limit.ok) return;

	const userIds = await getAllNotifySubUsers();
	for (let index = 0; index < userIds.length; index += 5) {
		const batch = userIds.slice(index, index + 5);
		const results = await Promise.allSettled(
			batch.map(userId => refreshNotificationsForUser(userId)),
		);
		for (const [resultIndex, result] of results.entries()) {
			if (result.status === "rejected") {
				console.error(
					`[admin] notification refresh failed for user ${batch[resultIndex]}`,
					result.reason,
				);
			}
		}
	}
	revalidatePath("/notifications");
	revalidatePath("/admin");
}
