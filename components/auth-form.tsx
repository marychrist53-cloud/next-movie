"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction, registerAction, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AuthForm({
	mode,
	registrationsOpen = true,
}: {
	mode: "login" | "register";
	registrationsOpen?: boolean;
}) {
	const action = mode === "login" ? loginAction : registerAction;
	const [state, formAction, pending] = useActionState<AuthState, FormData>(
		action,
		{},
	);

	return (
		<div className="mx-auto w-full max-w-sm">
			<div className="rounded-2xl border border-border/60 bg-card/50 p-6 sm:p-8">
				<h1 className="text-2xl font-extrabold tracking-tight">
					{mode === "login" ? "Welcome back" : "Create your account"}
				</h1>
				<p className="mt-1.5 text-sm text-muted-foreground">
					{mode === "login"
						? "Log in to sync your watchlist, ratings and notifications."
						: "Join to build your watchlist, rate titles and get release notifications."}
				</p>

				<form action={formAction} className="mt-6 space-y-4">
					{mode === "register" && (
						<label className="block space-y-1.5">
							<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Name
							</span>
							<Input name="name" required minLength={2} className="h-11" placeholder="Jane Doe" />
						</label>
					)}

					<label className="block space-y-1.5">
						<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Email
						</span>
						<Input
							name="email"
							type="email"
							required
							className="h-11"
							placeholder="you@example.com"
							autoComplete="email"
						/>
					</label>

					<label className="block space-y-1.5">
						<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Password
						</span>
						<Input
							name="password"
							type="password"
							required
							minLength={mode === "register" ? 8 : undefined}
							className="h-11"
							placeholder="••••••••"
							autoComplete={
								mode === "login" ? "current-password" : "new-password"
							}
						/>
					</label>

					{state.error && (
						<p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
							{state.error}
						</p>
					)}

					<Button type="submit" size="lg" disabled={pending} className="w-full">
						{pending
							? "Please wait..."
							: mode === "login"
								? "Log in"
								: "Create account"}
					</Button>
				</form>
			</div>

			<p className="mt-5 text-center text-sm text-muted-foreground">
				{mode === "login" && registrationsOpen ? (
					<>
						No account yet?{" "}
						<Link
							href="/register"
							className="font-semibold text-primary hover:underline">
							Sign up
						</Link>
					</>
				) : mode === "register" ? (
					<>
						Already have an account?{" "}
						<Link
							href="/login"
							className="font-semibold text-primary hover:underline">
							Log in
						</Link>
					</>
				) : (
					"New registrations are currently closed."
				)}
			</p>
		</div>
	);
}
