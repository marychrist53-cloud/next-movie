function Skeleton({ className }: { className?: string }) {
	return <div className={`animate-pulse rounded-lg bg-muted ${className ?? ""}`} />;
}

export default function Loading() {
	return (
		<div className="space-y-10">
			<Skeleton className="h-72 w-full rounded-2xl sm:h-96 lg:h-[28rem]" />

			<div className="space-y-5">
				<div className="flex items-center gap-2.5">
					<Skeleton className="size-8 rounded-lg" />
					<Skeleton className="h-6 w-32" />
				</div>
				<div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
					{Array.from({ length: 10 }).map((_, i) => (
						<div key={i} className="space-y-2">
							<Skeleton className="aspect-[2/3] w-full rounded-xl" />
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-3 w-1/3" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
