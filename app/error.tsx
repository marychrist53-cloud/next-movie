"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-8 text-center">
			<span className="flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
				<TriangleAlert className="size-6" />
			</span>
			<div>
				<h2 className="text-lg font-bold">Something went wrong</h2>
				<p className="mt-1 max-w-sm text-sm text-muted-foreground">
					{error.message || "An unexpected error occurred while loading data."}
				</p>
			</div>
			<button
				type="button"
				onClick={reset}
				className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">
				<RotateCcw className="size-4" />
				Try again
			</button>
		</div>
	);
}
