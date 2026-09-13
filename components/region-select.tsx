"use client";

import { Globe } from "lucide-react";

import { setRegionAction } from "@/app/actions/library";

const REGIONS = [
	{ code: "US", label: "United States" },
	{ code: "GB", label: "United Kingdom" },
	{ code: "CA", label: "Canada" },
	{ code: "DE", label: "Germany" },
	{ code: "FR", label: "France" },
	{ code: "IN", label: "India" },
	{ code: "AU", label: "Australia" },
	{ code: "BR", label: "Brazil" },
	{ code: "JP", label: "Japan" },
	{ code: "KR", label: "South Korea" },
];

export default function RegionSelect({ region }: { region: string }) {
	return (
		<label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
			<Globe className="size-4" />
			<span className="sr-only">Streaming region</span>
			<select
				value={region}
				onChange={e => void setRegionAction(e.target.value)}
				className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30">
				{REGIONS.map(r => (
					<option key={r.code} value={r.code}>
						{r.label}
					</option>
				))}
			</select>
		</label>
	);
}
