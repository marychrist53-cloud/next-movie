"use client";

import { useEffect } from "react";

export function useInert(active: boolean, elementId = "app-shell") {
	useEffect(() => {
		const element = document.getElementById(elementId);
		if (!element) return;
		if (active) {
			element.setAttribute("inert", "");
			return () => element.removeAttribute("inert");
		}
		element.removeAttribute("inert");
	}, [active, elementId]);
}
