"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

function urlBase64ToUint8Array(base64String: string) {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(base64);
	return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

export default function PushToggle() {
	const [state, setState] = useState<
		"unsupported" | "loading" | "off" | "on" | "denied"
	>("loading");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		async function init() {
			if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
				setState("unsupported");
				return;
			}
			if (Notification.permission === "denied") {
				setState("denied");
				return;
			}

			const registration = await navigator.serviceWorker.getRegistration();
			const existing = await registration?.pushManager.getSubscription();
			setState(existing ? "on" : "off");
		}
		void init();
	}, []);

	async function enable() {
		setBusy(true);
		try {
			const keyRes = await fetch("/api/push/key");
			if (!keyRes.ok) throw new Error();
			const { publicKey } = (await keyRes.json()) as { publicKey: string };

			const permission = await Notification.requestPermission();
			if (permission !== "granted") {
				setState("denied");
				return;
			}

			const registration = await navigator.serviceWorker.register("/sw.js");
			await navigator.serviceWorker.ready;

			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(publicKey),
			});

			const res = await fetch("/api/push/subscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(subscription.toJSON()),
			});
			if (!res.ok) throw new Error();

			setState("on");
		} catch {
			setState("off");
		} finally {
			setBusy(false);
		}
	}

	async function disable() {
		setBusy(true);
		try {
			const registration = await navigator.serviceWorker.getRegistration();
			const subscription = await registration?.pushManager.getSubscription();
			if (subscription) {
				await fetch("/api/push/subscribe", {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ endpoint: subscription.endpoint }),
				});
				await subscription.unsubscribe();
			}
			setState("off");
		} finally {
			setBusy(false);
		}
	}

	if (state === "unsupported") return null;

	return (
		<div className="rounded-2xl border border-border/60 p-4">
			<div className="flex items-center justify-between gap-4">
				<div>
					<p className="text-sm font-semibold">Push notifications</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						Get browser alerts the moment a release drops — no page open needed.
					</p>
				</div>
				{state === "loading" || busy ? (
					<Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
				) : state === "on" ? (
					<button
						type="button"
						onClick={disable}
						className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">
						<BellRing className="size-4" />
						On
					</button>
				) : (
					<button
						type="button"
						onClick={enable}
						className={cn(
							"inline-flex h-9 shrink-0 items-center rounded-full border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50",
							state === "denied" && "opacity-50",
						)}
						disabled={state === "denied"}>
						{state === "denied" ? "Blocked" : "Enable"}
					</button>
				)}
			</div>
			{state === "denied" && (
				<p className="mt-2 text-xs text-destructive">
					Notifications are blocked for this site — allow them in browser
					settings to enable push.
				</p>
			)}
		</div>
	);
}
