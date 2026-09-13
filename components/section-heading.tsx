import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function SectionHeading({
	icon,
	title,
	href,
	linkLabel = "View all",
	badge,
}: {
	icon?: React.ReactNode;
	title: string;
	href?: string;
	linkLabel?: string;
	/** Static text shown next to the title (e.g. credit counts) */
	badge?: string;
}) {
	return (
		<div className="flex items-center justify-between gap-4">
			<h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight sm:text-2xl">
				{icon && (
					<span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
						{icon}
					</span>
				)}
				{title}
				{badge && (
					<span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
						{badge}
					</span>
				)}
			</h2>
			{href && (
				<Link
					href={href}
					className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
					{linkLabel}
					<ChevronRight className="size-4" />
				</Link>
			)}
		</div>
	);
}
