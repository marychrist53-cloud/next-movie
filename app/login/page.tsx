import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AuthForm from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/db";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
	const user = await getCurrentUser();
	if (user) redirect("/");
	const registrationsOpen = (await getSetting("registrations_open")) !== "0";

	return (
		<div className="flex min-h-[60vh] items-center justify-center py-8">
			<AuthForm mode="login" registrationsOpen={registrationsOpen} />
		</div>
	);
}
