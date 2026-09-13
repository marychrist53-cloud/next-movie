"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { useInert } from "@/components/use-inert";
import { cn } from "@/lib/utils";

export function VideoModal({
	videoKey,
	title,
	onClose,
}: {
	videoKey: string;
	title: string;
	onClose: () => void;
}) {
	const closeRef = useRef<HTMLButtonElement>(null);

	useInert(true);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};

		document.addEventListener("keydown", onKeyDown);
		document.body.style.overflow = "hidden";
		closeRef.current?.focus();
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.body.style.overflow = "";
		};
	}, [onClose]);

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label={`${title} video`}
			className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
			<div
				className="absolute inset-0 bg-black/85 backdrop-blur-sm"
				onClick={onClose}
			/>

			<div className="relative w-full max-w-4xl">
				<div className="mb-2 flex items-center justify-between gap-4">
					<p className="truncate text-sm font-semibold text-foreground">
						{title}
					</p>
					<button
						ref={closeRef}
						type="button"
						onClick={onClose}
						aria-label="Close video"
						className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
						<X className="size-4" />
					</button>
				</div>

				<div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10">
					<iframe
						src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0`}
						title={`${title} video`}
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowFullScreen
						className="h-full w-full"
					/>
				</div>
			</div>
		</div>
	);
}

export default function TrailerButton({
	videoKey,
	title,
}: {
	videoKey: string;
	title: string;
}) {
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);

	function close() {
		setOpen(false);
		requestAnimationFrame(() => triggerRef.current?.focus());
	}

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				onClick={() => setOpen(true)}
				aria-label={`Watch trailer for ${title}`}
				className={cn(
					buttonVariants({ size: "lg" }),
					"shadow-lg shadow-primary/30",
				)}>
				<Play className="fill-current" />
				Watch trailer
			</button>

			{open &&
				createPortal(
					<VideoModal
						videoKey={videoKey}
						title={`${title} — Trailer`}
						onClose={close}
					/>,
					document.body,
				)}
		</>
	);
}
