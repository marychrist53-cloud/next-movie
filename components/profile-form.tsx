"use client";

import { useActionState } from "react";

import type { AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProfileForm({
	name,
	bio,
	action,
}: {
	name: string;
	bio: string;
	action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
}) {
	const [state, formAction, pending] = useActionState<AuthState, FormData>(
		action,
		{},
	);

	return (
		<form action={formAction} className="space-y-4 rounded-2xl border border-border/60 p-6">
			<label className="block space-y-1.5">
				<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Display name
				</span>
				<Input
					name="name"
					required
					minLength={2}
					maxLength={60}
					defaultValue={name}
					className="h-11"
				/>
			</label>

			<label className="block space-y-1.5">
				<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Bio
				</span>
				<textarea
					name="bio"
					maxLength={500}
					rows={4}
					defaultValue={bio}
					placeholder="Tell people about your taste in movies..."
					className="w-full resize-y rounded-xl border border-border bg-input/50 px-3.5 py-2.5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
				/>
			</label>

			{state.error && <p className="text-sm text-destructive">{state.error}</p>}

			<Button type="submit" disabled={pending}>
				{pending ? "Saving..." : "Save changes"}
			</Button>
		</form>
	);
}
