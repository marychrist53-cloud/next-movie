import Link from "next/link";
import { Bell, Clapperboard, LogOut, Megaphone, Settings as SettingsIcon, ShieldCheck } from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import SearchBar from "@/components/search-bar";
import ThemeToggle from "@/components/theme-toggle";
import { WatchlistLink, WatchedLink } from "@/components/watchlist-button";
import type { SessionUser } from "@/components/library-provider";

export default function SiteHeader({
	user,
	unread,
	staff,
	announcement,
	registrationsOpen,
}: {
	user: SessionUser | null;
	unread: number;
	staff: boolean;
	announcement: string;
	registrationsOpen: boolean;
}) {
	return (
		<>
			<header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
				<div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
					<Link
						href="/"
						className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
						<span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
							<Clapperboard className="size-5" />
						</span>
						<span className="text-lg font-bold tracking-tight">
							Next<span className="text-primary">Movie</span>
						</span>
					</Link>

					<SearchBar />

					<div className="ml-auto flex items-center gap-1 sm:ml-2">
						<ThemeToggle />

						{user ? (
							<>
								<Link
									href="/notifications"
									aria-label={`Notifications (${unread} unread)`}
									className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
									<Bell className="size-4.5" />
									{unread > 0 && (
										<span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
											{unread > 9 ? "9+" : unread}
										</span>
									)}
								</Link>

								<WatchlistLink />
								<WatchedLink />

								{staff && (
									<Link
										href="/admin"
										aria-label="Admin dashboard"
										title="Admin dashboard"
										className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
										<ShieldCheck className="size-4.5" />
									</Link>
								)}

								<div className="ml-1 flex items-center gap-1 rounded-full border border-border/60 py-1 pl-1 pr-1 sm:pr-1.5">
									<Link
										href={`/users/${user.id}`}
										title="Your profile"
										className="flex items-center gap-2 rounded-full px-1 py-0.5 transition-colors hover:bg-muted">
										<span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
											{user.name.charAt(0).toUpperCase()}
										</span>
										<span className="hidden max-w-24 truncate text-sm font-medium sm:block">
											{user.name}
										</span>
									</Link>
									<Link
										href="/settings"
										title="Settings"
										aria-label="Settings"
										className="hidden size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex">
										<SettingsIcon className="size-3.5" />
									</Link>
									<form action={logoutAction}>
										<button
											type="submit"
											aria-label="Log out"
											title="Log out"
											className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
											<LogOut className="size-3.5" />
										</button>
									</form>
								</div>
							</>
						) : (
							<div className="ml-1 flex items-center gap-2">
								<WatchlistLink />
								<WatchedLink />
								<Link
									href="/login"
									className="inline-flex h-8 items-center rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
									Log in
								</Link>
								{registrationsOpen && (
									<Link
										href="/register"
										className="inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">
										Sign up
									</Link>
								)}
							</div>
						)}
					</div>
				</div>
			</header>

			{announcement && (
				<div className="border-b border-primary/20 bg-primary/10 px-4 py-2 text-center text-sm">
					<Megaphone className="mr-1.5 inline size-3.5 text-primary" />
					<span className="text-foreground">{announcement}</span>
				</div>
			)}
		</>
	);
}
