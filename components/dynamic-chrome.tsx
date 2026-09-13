import LibraryHydrate from "@/components/library-hydrate";
import SiteHeader from "@/components/site-header";
import WatchlistSync from "@/components/watchlist-sync";
import { getCurrentUser } from "@/lib/auth";
import { getFavoriteIds, getSetting, getUnreadCount, getUserRole, getWatchlistIds } from "@/lib/db";

export default async function DynamicChrome() {
	const user = await getCurrentUser();
	const watchlistIds = user ? await getWatchlistIds(user.id) : [];
	const favoriteIds = user ? await getFavoriteIds(user.id) : [];
	const unread = user ? await getUnreadCount(user.id) : 0;
	const staff = user
		? ["admin", "owner"].includes(await getUserRole(user.id))
		: false;
	const announcement = (await getSetting("announcement")) ?? "";
	const registrationsOpen = (await getSetting("registrations_open")) !== "0";

	return (
		<>
			<LibraryHydrate
				user={user}
				watchlistIds={watchlistIds}
				favoriteIds={favoriteIds}
			/>
			<WatchlistSync />
			<SiteHeader
				user={user}
				unread={unread}
				staff={staff}
				announcement={announcement}
				registrationsOpen={registrationsOpen}
			/>
		</>
	);
}
