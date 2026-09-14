import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";

import Link from "next/link";

import AiChat from "@/components/ai-chat";
import DynamicChrome from "@/components/dynamic-chrome";
import {
	LibraryProvider,
} from "@/components/library-provider";
import NavLinks from "@/components/nav-links";
import SiteHeader from "@/components/site-header";
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
	let genres: GenreType[] = [];
	try {
		genres = await fetchGenres();
	} catch (error) {
		console.error("[layout] failed to load genres", error);
		genres = [];
	}

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
					user={null}
					initialWatchlistIds={[]}
					initialFavoriteIds={[]}
					initialWatchedIds={[]}>
					<a
						href="#main-content"
						className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground">
						Skip to content
					</a>

					<div id="app-shell" className="flex min-h-full flex-1 flex-col">
						<Suspense
							fallback={
								<SiteHeader
									user={null}
									unread={0}
									staff={false}
									announcement=""
									registrationsOpen
								/>
							}>
							<DynamicChrome />
						</Suspense>

						<div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col lg:flex-row">
							<aside className="hidden w-60 shrink-0 border-r border-border/60 py-4 lg:block">
								<div className="sticky top-[4.75rem] max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
									<NavLinks genres={genres} variant="sidebar" />
								</div>
							</aside>

							<main
								id="main-content"
								className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-8">
								<div className="mb-5 lg:hidden">
									<NavLinks genres={genres} variant="chips" />
								</div>
								{children}
							</main>
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
					</div>

					<AiChat />
				</LibraryProvider>
			</body>
		</html>
	);
}
