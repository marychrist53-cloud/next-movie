"use client";

import { useState } from "react";
import { Bell, BellOff } from "lucide-react";

import { toggleNotifyAction } from "@/app/actions/library";
import { useLibrary } from "@/components/library-provider";
import type { MediaType } from "@/types/global";
import { cn } from "@/lib/utils";

export default function NotifyButton({
	mediaType,
	mediaId,
	title,
	subscribed,
}: {
	mediaType: MediaType;
	mediaId: number;
	title: string;
	subscribed: boolean;
}) {
	const { user } = useLibrary();
	const [on, setOn] = useState(subscribed);
	const [pending, setPending] = useState(false);

	if (!user) {
		return (
			<a
				href="/login"
				title="Log in to get notified"
				className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
				<Bell className="size-4" />
				Notify me
			</a>
		);
	}

	async function toggle() {
		const previous = on;
		setPending(true);
		setOn(!previous);
		try {
			const result = await toggleNotifyAction(mediaType, mediaId, title);
			if (result.error) setOn(previous);
		} catch (error) {
			console.error("[notifications] subscription update failed", error);
			setOn(previous);
		} finally {
			setPending(false);
		}
	}

	return (
		<button
			type="button"
			onClick={toggle}
			disabled={pending}
			aria-pressed={on}
			title={
				on
					? "Notifications are on for this title"
					: "Get notified when this releases"
			}
			className={cn(
				"inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
				on
					? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
					: "border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
			)}>
			{on ? <Bell className="size-4" /> : <BellOff className="size-4" />}
			{on ? "Notifications on" : "Notify me"}
		</button>
	);
}
