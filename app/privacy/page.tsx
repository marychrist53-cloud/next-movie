import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Privacy Policy",
	description: "How Next Movie handles your data.",
};

export default function PrivacyPage() {
	return (
		<article className="mx-auto max-w-2xl space-y-6">
			<h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
				Privacy Policy
			</h1>
			<p className="text-sm text-muted-foreground">
				Last updated: September 2026
			</p>

			<section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
				<h2 className="text-lg font-bold text-foreground">What we store</h2>
				<p>
					When you create an account we store your name, email address and a
					scrypt-hashed password. We never store plaintext passwords. Your
					watchlist, favorites, ratings, comments and notification
					subscriptions are stored in our database and tied to your account.
				</p>

				<h2 className="text-lg font-bold text-foreground">Cookies</h2>
				<p>
					We use a single httpOnly session cookie to keep you logged in, and an
					optional region cookie to remember your preferred streaming region.
					No advertising or tracking cookies are set.
				</p>

				<h2 className="text-lg font-bold text-foreground">Push notifications</h2>
				<p>
					If you enable push notifications, your browser generates a
					subscription token that we store solely to deliver release alerts.
					You can disable them at any time from the notifications page or your
					browser settings.
				</p>

				<h2 className="text-lg font-bold text-foreground">Third-party data</h2>
				<p>
					Movie, TV and people data is provided by The Movie Database (TMDB).
					Their API is called server-side; your browser never talks to TMDB
					directly except to load poster images.
				</p>
				<p>
					When Gemini chat is configured, messages you send to the movie
					assistant are processed by Google&apos;s Gemini API to generate a
					response under Google&apos;s service terms. Google states that
					free-tier data may be used to improve its products. Do not include
					passwords or other sensitive personal information in chat messages. If
					Gemini is unavailable, the request is handled by the local TMDB
					assistant instead.
				</p>

				<h2 className="text-lg font-bold text-foreground">Deleting your data</h2>
				<p>
					You can remove individual comments, ratings and subscriptions from
					their respective pages. For full account deletion, contact us and we
					will remove your account and associated data.
				</p>
			</section>
		</article>
	);
}
