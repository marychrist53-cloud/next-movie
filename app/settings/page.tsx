import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { updateProfileAction } from "@/app/actions/auth";
import { ProfileForm } from "@/components/profile-form";
import { getCurrentUser } from "@/lib/auth";
import { getUserProfile } from "@/lib/db";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
	const user = await getCurrentUser();
	if (!user) redirect("/login");

	const profile = getUserProfile(user.id)!;

	return (
		<div className="mx-auto max-w-lg space-y-6">
			<div>
				<h1 className="text-xl font-bold tracking-tight sm:text-2xl">Settings</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Manage how you appear across Next Movie.
				</p>
			</div>

			<ProfileForm
				name={profile.name}
				bio={profile.bio}
				action={updateProfileAction}
			/>
		</div>
	);
}
