import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function CatalogError({
	message = "Movie data could not be loaded. Please try again.",
}: {
	message?: string;
}) {
	return (
		<div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-8 text-center">
			<span className="flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
				<TriangleAlert className="size-6" />
			</span>
			<div>
				<h1 className="text-lg font-bold">Catalog temporarily unavailable</h1>
				<p className="mt-1 max-w-md text-sm text-muted-foreground">
					{message}
				</p>
			</div>
			<Link
				href="/"
				className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">
				<RotateCcw className="size-4" />
				Back to home
			</Link>
		</div>
	);
}
