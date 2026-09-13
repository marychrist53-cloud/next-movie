import Link from "next/link";
import { Film } from "lucide-react";

export default function NotFound() {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-8 text-center">
			<span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
				<Film className="size-6" />
			</span>
			<div>
				<h2 className="text-lg font-bold">Not found</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					The page or movie you are looking for does not exist.
				</p>
			</div>
			<Link
				href="/"
				className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">
				Back to home
			</Link>
		</div>
	);
}
