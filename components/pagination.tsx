import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export default function Pagination({
	page,
	totalPages,
	basePath,
	query = {},
}: {
	page: number;
	totalPages: number;
	basePath: string;
	/** Extra query params preserved across pages (e.g. sort filters) */
	query?: Record<string, string | undefined>;
}) {
	if (totalPages <= 1) return null;

	const hrefFor = (p: number) => {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(query)) {
			if (value) params.set(key, value);
		}
		if (p > 1) params.set("page", String(p));
		const qs = params.toString();
		return qs ? `${basePath}?${qs}` : basePath;
	};

	const linkStyles =
		"inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

	return (
		<nav
			aria-label="Pagination"
			className="mt-10 flex items-center justify-center gap-3">
			{page > 1 ? (
				<Link
					href={hrefFor(page - 1)}
					className={cn(linkStyles, "text-foreground hover:bg-muted")}>
					<ChevronLeft className="size-4" />
					Previous
				</Link>
			) : (
				<span
					className={cn(linkStyles, "pointer-events-none opacity-40")}
					aria-disabled="true">
					<ChevronLeft className="size-4" />
					Previous
				</span>
			)}

			<span className="text-sm text-muted-foreground">
				Page <span className="font-semibold text-foreground">{page}</span> of{" "}
				{totalPages}
			</span>

			{page < totalPages ? (
				<Link
					href={hrefFor(page + 1)}
					className={cn(linkStyles, "text-foreground hover:bg-muted")}>
					Next
					<ChevronRight className="size-4" />
				</Link>
			) : (
				<span
					className={cn(linkStyles, "pointer-events-none opacity-40")}
					aria-disabled="true">
					Next
					<ChevronRight className="size-4" />
				</span>
			)}
		</nav>
	);
}
