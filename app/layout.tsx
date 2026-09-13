import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Link from "next/link";
import { Bell, Clapperboard, LogOut, Megaphone, Settings as SettingsIcon, ShieldCheck } from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import NavLinks from "@/components/nav-links";
import SearchBar from "@/components/search-bar";
import ThemeToggle from "@/components/theme-toggle";
import { WatchlistLink } from "@/components/watchlist-button";
import WatchlistSync from "@/components/watchlist-sync";
import AiChat from "@/components/ai-chat";
import {
	LibraryProvider,
	type SessionUser,
} from "@/components/library-provider";
import { getCurrentUser } from "@/lib/auth";
import { getUserRole } from "@/lib/db";
import { getFavoriteIds, getSetting, getUnreadCount, getWatchlistIds } from "@/lib/db";
import { fetchGenres } from "@/lib/tmdb";
import { themeScript } from "@/lib/theme";
import type { GenreType } from "@/types/global";

const geistSans = Geist({
	variable: "--font-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: {
		default: "Next Movie — Discover your next favorite film",
		template: "%s · Next Movie",
	},
	description:
		"Browse popular and upcoming movies, explore genres, search the TMDB catalog, build a watchlist and dive into cast details.",
};

export default async function RootLayout({
	children,
}: LayoutProps<"/">) {
	const user = await getCurrentUser();

	let genres: GenreType[] = [];
	try {
		genres = await fetchGenres();
	} catch (error) {
		console.error("[layout] failed to load genres", error);
		genres = [];
	}

	const watchlistIds = user ? getWatchlistIds(user.id) : [];
	const favoriteIds = user ? getFavoriteIds(user.id) : [];
	const unread = user ? getUnreadCount(user.id) : 0;
	const staff = user ? ["admin", "owner"].includes(getUserRole(user.id)) : false;
	const announcement = getSetting("announcement") ?? "";
	const registrationsOpen = getSetting("registrations_open") !== "0";

	return (
		<html
			lang="en"
			className={`dark h-full antialiased ${geistSans.variable} ${geistMono.variable}`}>
			<body className="flex min-h-full flex-col bg-background text-foreground">
				{/* Theme applied pre-paint. Wrapped as an opaque HTML string so React
				    never renders a <script> element (avoids React 19 script warnings). */}
				<div
					hidden
					dangerouslySetInnerHTML={{ __html: `<script>${themeScript}</script>` }}
				/>

				<LibraryProvider
					user={user as SessionUser | null}
					initialWatchlistIds={watchlistIds}
					initialFavoriteIds={favoriteIds}>
					<WatchlistSync />

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

					<div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col lg:flex-row">
						<aside className="hidden w-60 shrink-0 border-r border-border/60 py-4 lg:block">
							<div className="sticky top-[4.75rem] max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
								<NavLinks genres={genres} variant="sidebar" />
							</div>
						</aside>

						<div className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-8">
							<div className="mb-5 lg:hidden">
								<NavLinks genres={genres} variant="chips" />
							</div>
							{children}
						</div>
					</div>

					<footer className="border-t border-border/60 py-6">
						<div className="mx-auto flex w-full max-w-[1440px] flex-col items-center justify-between gap-3 px-4 text-center text-sm text-muted-foreground sm:px-6">
							<p className="flex gap-3">
								<Link href="/privacy" className="underline underline-offset-4 transition-colors hover:text-foreground">Privacy</Link>
								<Link href="/terms" className="underline underline-offset-4 transition-colors hover:text-foreground">Terms</Link>
							</p>
							<p>
								&copy; {new Date().getFullYear()} Next Movie. All rights reserved.
							</p>
							<p className="max-w-2xl text-xs leading-relaxed">
								Data &amp; images by{" "}
								<a
									href="https://www.themoviedb.org"
									target="_blank"
									rel="noreferrer"
									className="underline underline-offset-4 transition-colors hover:text-foreground">
									TMDB
								</a>. This product uses the TMDB API but is not endorsed or
								certified by TMDB.
							</p>
						</div>
					</footer>

					<AiChat />
				</LibraryProvider>
			</body>
		</html>
	);
}
