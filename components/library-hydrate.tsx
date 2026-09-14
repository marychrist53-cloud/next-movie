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
	watchedIds,
}: {
	user: SessionUser | null;
	watchlistIds: string[];
	favoriteIds: string[];
	watchedIds: string[];
}) {
	const { hydrateAccount } = useLibrary();

	useEffect(() => {
		hydrateAccount({ user, watchlistIds, favoriteIds, watchedIds });
	}, [favoriteIds, hydrateAccount, user, watchedIds, watchlistIds]);

	return null;
}
