import Image from "next/image";
import { cookies } from "next/headers";
import { MonitorPlay } from "lucide-react";

import RegionSelect from "@/components/region-select";
import SectionHeading from "@/components/section-heading";
import { fetchWatchProviders, imageUrl } from "@/lib/tmdb";
import type { MediaType, ProviderType } from "@/types/global";

function Providers({
	providers,
	link,
	region,
}: {
	providers: ProviderType[];
	link: string | null;
	region: string;
}) {
	if (!providers.length && !link) return null;

	return (
		<section>
			<div className="flex items-center justify-between gap-4">
				<SectionHeading
					icon={<MonitorPlay className="size-4.5" />}
					title="Where to watch"
					href={link ?? undefined}
					linkLabel={link ? "JustWatch" : undefined}
				/>
				<RegionSelect region={region} />
			</div>
			{providers.length > 0 && (
				<div className="mt-4 flex flex-wrap gap-3">
					{providers.map(provider => (
						<span
							key={provider.provider_name}
							title={`Stream on ${provider.provider_name}`}
							className="group relative size-12 overflow-hidden rounded-xl bg-muted ring-1 ring-white/10 transition-transform hover:-translate-y-0.5 hover:ring-primary/50">
							{provider.logo_path && (
								<Image
									src={imageUrl(provider.logo_path, "w92")!}
									alt={provider.provider_name}
									fill
									sizes="48px"
									className="object-cover"
								/>
							)}
						</span>
					))}
				</div>
			)}
		</section>
	);
}

export default async function WatchProviders({
	mediaType,
	id,
}: {
	mediaType: MediaType;
	id: string;
}) {
	const region = (await cookies()).get("nm-region")?.value ?? "US";
	const { providers, link } = await fetchWatchProviders(mediaType, id, region);
	return <Providers providers={providers} link={link} region={region} />;
}
