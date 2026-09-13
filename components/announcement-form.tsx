"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";

import type { AdminState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export function AnnouncementForm({
	action,
	initialValue,
}: {
	action: (prev: AdminState, formData: FormData) => Promise<AdminState>;
	initialValue: string;
}) {
	const [state, formAction, pending] = useActionState<AdminState, FormData>(
		action,
		{},
	);

	return (
		<form action={formAction} className="mt-3 space-y-2.5">
			<textarea
				name="announcement"
				maxLength={300}
				rows={2}
				defaultValue={initialValue}
				placeholder="e.g. New: TV episode notifications are here!"
				className="w-full resize-y rounded-xl border border-border bg-input/50 px-3.5 py-2.5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
			/>
			{state.error && <p className="text-sm text-destructive">{state.error}</p>}
			<Button type="submit" size="sm" disabled={pending}>
				<Save className="size-3.5" />
				{pending ? "Saving..." : "Save announcement"}
			</Button>
		</form>
	);
}
