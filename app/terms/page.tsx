import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Terms of Service",
	description: "The terms that apply when you use Next Movie.",
};

export default function TermsPage() {
	return (
		<article className="mx-auto max-w-2xl space-y-6">
			<h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
				Terms of Service
			</h1>
			<p className="text-sm text-muted-foreground">Last updated: August 2026</p>

			<section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
				<h2 className="text-lg font-bold text-foreground">The service</h2>
				<p>
					Next Movie is a discovery interface for movie and TV information
					powered by The Movie Database (TMDB). We do not host, stream or
					provide downloads of any copyrighted content.
				</p>

				<h2 className="text-lg font-bold text-foreground">Your account</h2>
				<p>
					You are responsible for keeping your credentials secure and for
					content you post. Comments that are unlawful, harassing or abusive
					may be removed by moderators at any time.
				</p>

				<h2 className="text-lg font-bold text-foreground">Data attribution</h2>
				<p>
					This product uses the TMDB API but is not endorsed or certified by
					TMDB. All movie information and images belong to their respective
					owners.
				</p>

				<h2 className="text-lg font-bold text-foreground">Availability</h2>
				<p>
					The service is provided &ldquo;as is&rdquo; without warranties of any
					kind. Features may change or be discontinued without notice.
				</p>

				<h2 className="text-lg font-bold text-foreground">Contact</h2>
				<p>
					For copyright (DMCA) notices or any other concerns, reach out via the
					project repository.
				</p>
			</section>
		</article>
	);
}
