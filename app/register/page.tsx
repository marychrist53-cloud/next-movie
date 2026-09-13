import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import AuthForm from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/db";

export const metadata: Metadata = { title: "Sign up" };

export default async function RegisterPage() {
	const user = await getCurrentUser();
	if (user) redirect("/");
	const registrationsOpen = getSetting("registrations_open") !== "0";

	return (
		<div className="flex min-h-[60vh] items-center justify-center py-8">
			{registrationsOpen ? (
				<AuthForm mode="register" />
			) : (
				<div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed p-8 text-center">
					<span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
						<LockKeyhole className="size-6" />
					</span>
					<div>
						<h1 className="text-xl font-bold">Registration is closed</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							New accounts are temporarily disabled by the site owner.
						</p>
					</div>
					<Link
						href="/login"
						className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
						Log in
					</Link>
				</div>
			)}
		</div>
	);
}
