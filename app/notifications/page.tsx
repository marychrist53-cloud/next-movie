import type { Metadata } from "next";
import Link from "next/link";
import { BellOff, RefreshCw } from "lucide-react";

import {
	markNotificationsReadForm,
	refreshNotificationsForm,
} from "@/app/actions/library";
import PushToggle from "@/components/push-toggle";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

function kindIcon(kind: string) {
	if (kind === "digital") return "Digital release";
	if (kind === "released") return "In theaters";
	if (kind.startsWith("ep-")) return "New episode";
	return "Update";
}

export default async function NotificationsPage() {
	const user = await getCurrentUser();

	if (!user) {
		return (
			<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-8 text-center">
				<span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<BellOff className="size-6" />
				</span>
				<div>
					<h1 className="text-lg font-bold">Notifications</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Log in and tap “Notify me” on any title to get release alerts here.
					</p>
				</div>
				<Link
					href="/login"
					className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">
					Log in
				</Link>
			</div>
		);
	}

	const notifications = await getNotifications(user.id);
	const unread = notifications.filter(n => !n.read_at).length;

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-xl font-bold tracking-tight sm:text-2xl">
						Notifications
						{unread > 0 && (
							<span className="ml-2 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
								{unread} new
							</span>
						)}
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Alerts for titles you subscribed to.
					</p>
				</div>

				<div className="flex gap-2">
					<form action={refreshNotificationsForm}>
						<button
							type="submit"
							className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
							<RefreshCw className="size-4" />
							Check now
						</button>
					</form>
					{unread > 0 && (
						<form action={markNotificationsReadForm}>
							<button
								type="submit"
								className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
								Mark all read
							</button>
						</form>
					)}
				</div>
			</div>

			<PushToggle />

			{notifications.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
					<BellOff className="size-8 opacity-50" />
					<p>
						No notifications yet. Tap “Notify me” on any movie or show to
						subscribe.
					</p>
				</div>
			) : (
				<div className="space-y-2.5">
					{notifications.map(n => (
						<Link
							key={n.id}
							href={n.media_type === "tv" ? `/tv/${n.media_id}` : `/detail/${n.media_id}`}
							className={cn(
								"flex items-start gap-3.5 rounded-2xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								n.read_at
									? "border-border/60 hover:border-primary/40"
									: "border-primary/40 bg-primary/5 hover:border-primary/60",
							)}>
							<span
								className={cn(
									"mt-1.5 size-2 shrink-0 rounded-full",
									n.read_at ? "bg-muted-foreground/30" : "bg-primary",
								)}
							/>
							<div className="min-w-0">
								<p className="text-xs font-semibold uppercase tracking-wider text-primary">
									{kindIcon(n.kind)}
								</p>
								<p className="mt-0.5 font-semibold">{n.title}</p>
								<p className="mt-0.5 text-sm text-muted-foreground">
									{n.message}
								</p>
								<p className="mt-1 text-xs text-muted-foreground/70">
									{new Date(n.created_at + "Z").toLocaleString("en-US", {
										month: "short",
										day: "numeric",
										hour: "numeric",
										minute: "2-digit",
									})}
								</p>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
