self.addEventListener("push", event => {
	if (!event.data) return;

	let data = { title: "Next Movie", body: "", url: "/" };
	try {
		data = { ...data, ...event.data.json() };
	} catch {}

	event.waitUntil(
		self.registration.showNotification(data.title, {
			body: data.body,
			icon: "/icon.svg",
			badge: "/icon.svg",
			data: { url: data.url },
		}),
	);
});

self.addEventListener("notificationclick", event => {
	event.notification.close();
	const url = event.notification.data?.url || "/";
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
			for (const client of clients) {
				if (client.url.includes(self.location.origin) && "focus" in client) {
					client.navigate(url);
					return client.focus();
				}
			}
			return self.clients.openWindow(url);
		}),
	);
});
