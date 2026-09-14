import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
	Bell,
	Crown,
	Megaphone,
	ShieldAlert,
	ShieldCheck,
	ShieldX,
	Trash2,
	UserX,
} from "lucide-react";

import {
	adminDeleteCommentFormAction,
} from "@/app/actions/library";
import {
	refreshAllNotificationsFormAction,
	setAnnouncementAction,
	setBannedFormAction,
	setRegistrationsFormAction,
	setUserRoleFormAction,
} from "@/app/actions/admin";
import { getCurrentUser } from "@/lib/auth";
import {
	getAllComments,
	getAllUsers,
	getSetting,
	getUserRole,
	getSiteStats,
} from "@/lib/db";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AnnouncementForm } from "@/components/announcement-form";

export const metadata: Metadata = { title: "Admin" };

const TABS = [
	{ id: "overview", label: "Overview", ownerOnly: false },
	{ id: "users", label: "Users", ownerOnly: true },
	{ id: "moderation", label: "Moderation", ownerOnly: false },
	{ id: "settings", label: "Settings", ownerOnly: true },
] as const;

const ROLE_STYLES: Record<string, string> = {
	owner: "bg-amber-400/15 text-amber-400",
	admin: "bg-primary/15 text-primary",
	user: "bg-muted text-muted-foreground",
};

type Props = {
	searchParams: Promise<{ tab?: string }>;
};

export default async function AdminPage({ searchParams }: Props) {
	const user = await getCurrentUser();
	if (!user) redirect("/login");

	const role = await getUserRole(user.id);
	if (role !== "admin" && role !== "owner") {
		return (
			<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-8 text-center">
				<span className="flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
					<ShieldAlert className="size-6" />
				</span>
				<h1 className="text-lg font-bold">Admins only</h1>
				<p className="text-sm text-muted-foreground">
					You do not have permission to view this page.
				</p>
			</div>
		);
	}

	const isOwner = role === "owner";
	const { tab: tabParam } = await searchParams;
	const activeTab = TABS.some(t => t.id === tabParam) ? tabParam! : "overview";
	const visibleTabs = TABS.filter(t => !t.ownerOnly || isOwner);
	const currentTab = visibleTabs.some(t => t.id === activeTab)
		? activeTab
		: visibleTabs[0].id;

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-xl font-bold tracking-tight sm:text-2xl">
						Admin dashboard
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Website management panel.
					</p>
				</div>
				<span
					className={cn(
						"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
						ROLE_STYLES[role],
					)}>
					{isOwner ? <Crown className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
					{role}
				</span>
			</div>

			<nav className="flex gap-1.5 overflow-x-auto rounded-xl border border-border/60 p-1.5">
				{visibleTabs.map(tab => (
					<Link
						key={tab.id}
						href={`/admin?tab=${tab.id}`}
						className={cn(
							"whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
							currentTab === tab.id
								? "bg-primary text-primary-foreground shadow-sm"
								: "text-muted-foreground hover:bg-muted hover:text-foreground",
						)}>
						{tab.label}
					</Link>
				))}
			</nav>

			{currentTab === "overview" && <OverviewTab />}
			{currentTab === "users" && isOwner && <UsersTab currentUserId={user.id} />}
			{currentTab === "moderation" && <ModerationTab />}
			{currentTab === "settings" && isOwner && <SettingsTab />}
		</div>
	);
}

async function OverviewTab() {
	const stats = await getSiteStats();
	const registrationsOpen = (await getSetting("registrations_open")) !== "0";
	const announcement = (await getSetting("announcement")) ?? "";

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
				<Stat label="Users" value={stats.users} />
				<Stat label="Comments" value={stats.comments} />
				<Stat label="Ratings" value={stats.ratings} />
				<Stat label="Watchlist" value={stats.watchlist} />
				<Stat label="Favorites" value={stats.favorites} />
				<Stat label="Watched" value={stats.watched} />
				<Stat label="Alert subs" value={stats.notifySubs} />
				<Stat label="Alerts sent" value={stats.notifications} />
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<div className="rounded-2xl border border-border/60 p-4">
					<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Registrations
					</p>
					<p className="mt-1 font-semibold">
						{registrationsOpen ? "Open" : "Closed"}
					</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						Manage in the Settings tab.
					</p>
				</div>
				<div className="rounded-2xl border border-border/60 p-4">
					<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Announcement banner
					</p>
					<p className="mt-1 line-clamp-2 font-semibold">
						{announcement || "None"}
					</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						Manage in the Settings tab.
					</p>
				</div>
			</div>

			<form action={refreshAllNotificationsFormAction}>
				<button
					type="submit"
					className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
					<Bell className="size-4" />
					Run notification check for all users
				</button>
			</form>
		</div>
	);
}

async function UsersTab({ currentUserId }: { currentUserId: number }) {
	const users = await getAllUsers();

	return (
		<div className="overflow-hidden rounded-2xl border border-border/60">
			{users.map(u => {
				const isSelf = u.id === currentUserId;
				const targetRole = u.role;
				const isTargetOwner = targetRole === "owner";
				const banned = !!u.banned;

				return (
					<div
						key={u.id}
						className="flex flex-wrap items-center gap-3 border-b border-border/60 p-3.5 last:border-b-0">
						<span
							className={cn(
								"flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
								banned
									? "bg-destructive/15 text-destructive"
									: "bg-primary/15 text-primary",
							)}>
							{u.name.charAt(0).toUpperCase()}
						</span>
						<div className="min-w-0 flex-1">
							<p className="flex flex-wrap items-center gap-2 truncate text-sm font-semibold">
								<Link href={`/users/${u.id}`} className="hover:text-primary">
									{u.name}
								</Link>
								<span
									className={cn(
										"rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
										ROLE_STYLES[targetRole],
									)}>
									{targetRole}
								</span>
								{banned && (
									<span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
										<UserX className="size-3" />
										Banned
									</span>
								)}
							</p>
							<p className="truncate text-xs text-muted-foreground">
								{u.email} · joined {formatDateShort(u.created_at)}
							</p>
						</div>

						{isTargetOwner || isSelf ? (
							<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
								<ShieldX className="size-3.5" />
								{isSelf ? "You" : "Protected"}
							</span>
						) : (
							<div className="flex flex-wrap items-center gap-2">
								<form
									action={setUserRoleFormAction}
									className="flex items-center gap-2">
									<input type="hidden" name="userId" value={u.id} />
									<select
										name="role"
										defaultValue={targetRole}
										className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30">
										<option value="user">User</option>
										<option value="admin">Admin</option>
									</select>
									<button
										type="submit"
										className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80">
										Apply
									</button>
								</form>

								<form action={setBannedFormAction}>
									<input type="hidden" name="userId" value={u.id} />
									<input type="hidden" name="banned" value={banned ? "0" : "1"} />
									<button
										type="submit"
										className={cn(
											"inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
											banned
												? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
												: "border-destructive/40 text-destructive hover:bg-destructive/10",
										)}>
										{banned ? "Unban" : "Ban"}
									</button>
								</form>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

async function ModerationTab() {
	const recent = await getAllComments(50);

	return (
		<section>
			<h2 className="text-lg font-bold tracking-tight">Recent comments</h2>
			<div className="mt-4 space-y-2">
				{recent.map(comment => (
					<div
						key={comment.id}
						className="flex items-start gap-3 rounded-xl border border-border/60 p-3.5">
						<div className="min-w-0 flex-1">
							<p className="text-xs text-muted-foreground">
								<Link
									href={`/users/${comment.user_id}`}
									className="font-semibold text-foreground hover:text-primary">
									{comment.author}
								</Link>{" "}
								· {formatDateShort(comment.created_at)}
							</p>
							<p className="mt-1 line-clamp-2 text-sm">{comment.body}</p>
						</div>
						<form action={adminDeleteCommentFormAction.bind(null, comment.id)}>
							<button
								type="submit"
								aria-label="Delete comment"
								className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
								<Trash2 className="size-4" />
							</button>
						</form>
					</div>
				))}
				{recent.length === 0 && (
					<p className="text-sm text-muted-foreground">No comments yet.</p>
				)}
			</div>
		</section>
	);
}

async function SettingsTab() {
	const registrationsOpen = (await getSetting("registrations_open")) !== "0";
	const announcement = (await getSetting("announcement")) ?? "";

	return (
		<div className="space-y-6 sm:max-w-xl">
			<div className="rounded-2xl border border-border/60 p-5">
				<h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
					Registrations
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					Control whether new visitors can create accounts. The owner account is
					always exempt.
				</p>
				<div className="mt-3 flex gap-2">
					<form action={setRegistrationsFormAction}>
						<input type="hidden" name="open" value="1" />
						<button
							type="submit"
							className={cn(
								"inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
								registrationsOpen
									? "border-primary bg-primary text-primary-foreground"
									: "border-border text-muted-foreground hover:bg-muted",
							)}>
							Open
						</button>
					</form>
					<form action={setRegistrationsFormAction}>
						<input type="hidden" name="open" value="0" />
						<button
							type="submit"
							className={cn(
								"inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
								!registrationsOpen
									? "border-primary bg-primary text-primary-foreground"
									: "border-border text-muted-foreground hover:bg-muted",
							)}>
							Closed
						</button>
					</form>
				</div>
			</div>

			<div className="rounded-2xl border border-border/60 p-5">
				<h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
					<Megaphone className="size-4" />
					Announcement banner
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					Shown site-wide under the header. Leave empty to hide.
				</p>
				<AnnouncementForm
					action={setAnnouncementAction}
					initialValue={announcement}
				/>
			</div>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-xl border border-border/60 p-4 text-center">
			<p className="text-2xl font-extrabold">{value}</p>
			<p className="text-xs text-muted-foreground">{label}</p>
		</div>
	);
}
