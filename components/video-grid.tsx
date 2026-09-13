"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

import { VideoModal } from "@/components/trailer-button";
import { youtubeThumb } from "@/lib/tmdb";
import type { VideoType } from "@/types/global";

export default function VideoGrid({
	videos,
	title,
}: {
	videos: VideoType[];
	title: string;
}) {
	const [active, setActive] = useState<VideoType | null>(null);

	if (!videos.length) return null;

	return (
		<>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{videos.slice(0, 6).map(video => (
					<button
						key={video.id}
						type="button"
						onClick={() => setActive(video)}
						className="group relative aspect-video overflow-hidden rounded-xl bg-muted text-left shadow-md ring-1 ring-white/5 transition-all duration-300 hover:-translate-y-1 hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
						<Image
							src={youtubeThumb(video.key)}
							alt=""
							fill
							sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
							className="object-cover opacity-90 transition-transform duration-300 group-hover:scale-105"
						/>
						<span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
						<span className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors group-hover:bg-primary">
							<Play className="size-5 fill-current text-white" />
						</span>
						<span className="absolute inset-x-3 bottom-2.5 truncate text-sm font-medium text-white drop-shadow">
							{video.name}
						</span>
						<span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white/90 backdrop-blur-sm">
							{video.type}
						</span>
					</button>
				))}
			</div>

			{active && (
				<VideoModal
					videoKey={active.key}
					title={`${title} — ${active.name}`}
					onClose={() => setActive(null)}
				/>
			)}
		</>
	);
}
