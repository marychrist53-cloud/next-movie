"use client";

import { Moon, Sun } from "lucide-react";

import { THEME_KEY } from "@/lib/theme";

export default function ThemeToggle({ className }: { className?: string }) {
	function toggle() {
		const isDark = document.documentElement.classList.toggle("dark");
		try {
			localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
		} catch {}
	}

	return (
		<button
			type="button"
			onClick={toggle}
			aria-label="Toggle dark mode"
			className={
				className ??
				"flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			}>
			<Sun className="size-4.5 dark:hidden" />
			<Moon className="hidden size-4.5 dark:block" />
		</button>
	);
}
