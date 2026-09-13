"use client";

import { useEffect } from "react";

import {
	useLibrary,
	type SessionUser,
} from "@/components/library-provider";

export default function LibraryHydrate({
	user,
	watchlistIds,
	favoriteIds,
}: {
	user: SessionUser | null;
	watchlistIds: string[];
	favoriteIds: string[];
}) {
	const { hydrateAccount } = useLibrary();

	useEffect(() => {
		hydrateAccount({ user, watchlistIds, favoriteIds });
	}, [favoriteIds, hydrateAccount, user, watchlistIds]);

	return null;
}
