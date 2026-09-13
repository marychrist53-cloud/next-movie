export function formatDateShort(date: string): string {
	const hasTimeZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(date);
	const normalized = date.includes(" ")
		? date.replace(" ", "T")
		: date;
	const parsed = new Date(hasTimeZone ? normalized : `${normalized}Z`);
	if (Number.isNaN(parsed.getTime())) return "Unknown date";

	return parsed.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
}
