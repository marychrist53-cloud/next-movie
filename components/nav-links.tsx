"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarDays, Compass, Film, ChevronDown, TrendingUp, Tv } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GenreType } from "@/types/global";

type NavLinkItem = {
	href: string;
	label: string;
	chipLabel?: string;
	icon?: React.ReactNode;
};

type NavGroup = {
	id: string;
	label: string;
	icon?: React.ReactNode;
	links: NavLinkItem[];
	groups?: NavGroup[];
};

type NavSection = {
	id: string;
	label: string;
	links: NavLinkItem[];
	groups?: NavGroup[];
};

export default function NavLinks({
	genres,
	variant,
}: {
	genres: GenreType[];
	variant: "sidebar" | "chips";
}) {
	const pathname = usePathname();

	const sections = useMemo<NavSection[]>(
		() => [
			{
				id: "movies",
				label: "Movies",
				groups: [
					{
						id: "movies-release-today",
						label: "Release Today",
						icon: <CalendarDays className="size-4 shrink-0" />,
						links: [
							{
								href: "/browse/movies/theatrical-today",
								label: "Theatrical",
								chipLabel: "Theatrical Movies",
							},
							{
								href: "/browse/movies/digital-today",
								label: "Digital",
								chipLabel: "Digital Movies",
							},
						],
					},
				],
				links: [
					{
						href: "/browse/movies/trending",
						label: "Trending",
						icon: <TrendingUp className="size-4 shrink-0" />,
					},
					{ href: "/browse/movies/popular", label: "Popular" },
					{ href: "/browse/movies/top-rated", label: "Top Rated" },
					{ href: "/browse/movies/now-playing", label: "Now Playing" },
					{ href: "/browse/movies/upcoming", label: "Upcoming" },
				],
			},
			{
				id: "tv",
				label: "TV Shows",
				groups: [
					{
						id: "tv-release-today",
						label: "Release Today",
						icon: <Tv className="size-4 shrink-0" />,
						links: [
							{
								href: "/browse/tv/theatrical-today",
								label: "Theatrical",
								chipLabel: "Theatrical Series",
							},
							{
								href: "/browse/tv/digital-today",
								label: "Digital",
								chipLabel: "Digital Series",
							},
						],
					},
				],
				links: [
					{
						href: "/browse/tv/trending",
						label: "Trending",
						icon: <TrendingUp className="size-4 shrink-0" />,
					},
					{ href: "/browse/tv/popular", label: "Popular" },
					{ href: "/browse/tv/top-rated", label: "Top Rated" },
					{ href: "/browse/tv/on-the-air", label: "On the Air" },
				],
			},
			animeSection("japanese", "Japanese Anime", "JP"),
			animeSection("chinese", "Chinese Anime", "CN"),
			{
				id: "genres",
				label: "Genres",
				links: genres.map(genre => ({
					href: `/genre/${encodeURIComponent(genre.name)}/${genre.id}`,
					label: genre.name,
				})),
			},
		],
		[genres],
	);

	const activeSectionId = useMemo(() => {
		if (pathname.startsWith("/browse/movies")) return "movies";
		if (pathname.startsWith("/browse/tv")) return "tv";
		if (pathname.startsWith("/browse/anime/japanese")) return "anime-japanese";
		if (pathname.startsWith("/browse/anime/chinese")) return "anime-chinese";
		if (pathname.startsWith("/genre")) return "genres";
		return null;
	}, [pathname]);

	const sectionLinkCount = (section: NavSection) =>
		(section.groups?.reduce((count, group) => count + groupLinkCount(group), 0) ??
			0) + section.links.length;

	const chipLinks = (section: NavSection) => [
		...(section.groups ?? []).flatMap(flattenGroupLinks),
		...section.links,
	];

	const [manualState, setManualState] = useState<Record<string, boolean>>({});

	const isOpen = (section: NavSection) =>
		manualState[section.id] ?? section.id === activeSectionId;

	function toggleSection(sectionId: string) {
		setManualState(prev => ({
			...prev,
			[sectionId]: !(
				prev[sectionId] ?? sectionId === activeSectionId
			),
		}));
	}

	const isActive = (href: string) => {
		if (href === "/") return pathname === "/";
		return pathname === href || pathname.startsWith(`${href}/`);
	};

	const linkClass = (href: string) =>
		cn(
			"flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
			isActive(href)
				? "bg-primary/15 text-primary"
				: "text-muted-foreground hover:bg-muted hover:text-foreground",
		);

	if (variant === "chips") {
		return (
			<nav
				aria-label="Browse"
				className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
				<ChipLink href="/" icon={<Film className="size-4 shrink-0" />} label="All Movies" active={isActive("/")} />
				<ChipLink href="/discover" icon={<Compass className="size-4 shrink-0" />} label="Discover" active={isActive("/discover")} />
				{sections.flatMap(section =>
					chipLinks(section).map(link => (
						<ChipLink
							key={link.href}
							href={link.href}
							label={link.chipLabel ?? link.label}
							active={isActive(link.href)}
						/>
					)),
				)}
			</nav>
		);
	}

	return (
		<nav aria-label="Browse" className="hidden flex-col lg:flex">
			<div className="mb-4 flex flex-col gap-1">
				<Link href="/" className={linkClass("/")}>
					<Film className="size-4 shrink-0" />
					All Movies
				</Link>
				<Link href="/discover" className={linkClass("/discover")}>
					<Compass className="size-4 shrink-0" />
					Discover
				</Link>
			</div>

			{sections.map(section => (
				<div key={section.id} className="mb-2">
					<button
						type="button"
						onClick={() => toggleSection(section.id)}
						aria-expanded={isOpen(section)}
						className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
						<span className="flex items-center gap-2">
							{section.label}
							<span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-normal">
								{sectionLinkCount(section)}
							</span>
						</span>
						<ChevronDown
							className={cn(
								"size-3.5 transition-transform duration-200",
								isOpen(section) && "rotate-180 text-primary",
							)}
						/>
					</button>

					{isOpen(section) && (
						<div className="mt-1 ml-4 flex flex-col gap-0.5 border-l border-border/60 pl-2">
							{section.groups?.map(group => (
								<NavGroupLinks
									key={group.id}
									group={group}
									linkClass={linkClass}
								/>
							))}
							{section.links.map(link => (
								<Link
									key={link.href}
									href={link.href}
									className={linkClass(link.href)}>
									{link.icon}
									{link.label}
								</Link>
							))}
						</div>
					)}
				</div>
			))}
		</nav>
	);
}

function animeSection(
	origin: "japanese" | "chinese",
	label: string,
	chip: string,
): NavSection {
	const base = `/browse/anime/${origin}`;
	return {
		id: `anime-${origin}`,
		label,
		links: [
			{
				href: `${base}/release-today`,
				label: "Release Today",
				chipLabel: `${chip} Release Today`,
				icon: <CalendarDays className="size-4 shrink-0" />,
			},
			{
				href: `${base}/top-rated`,
				label: "Top Rated",
				chipLabel: `${chip} Top Rated`,
			},
			{
				href: `${base}/trending`,
				label: "Trending",
				chipLabel: `${chip} Trending`,
				icon: <TrendingUp className="size-4 shrink-0" />,
			},
			{
				href: `${base}/upcoming`,
				label: "Upcoming",
				chipLabel: `${chip} Upcoming`,
			},
		],
	};
}

function groupLinkCount(group: NavGroup): number {
	return (
		(group.groups?.reduce((count, child) => count + groupLinkCount(child), 0) ??
			0) + group.links.length
	);
}

function flattenGroupLinks(group: NavGroup): NavLinkItem[] {
	return [
		...(group.groups ?? []).flatMap(flattenGroupLinks),
		...group.links,
	];
}

function NavGroupLinks({
	group,
	linkClass,
}: {
	group: NavGroup;
	linkClass: (href: string) => string;
}) {
	return (
		<div className="mb-1">
			<p className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				{group.icon}
				{group.label}
			</p>
			<div className="ml-3 flex flex-col gap-0.5 border-l border-border/40 pl-1">
				{group.groups?.map(child => (
					<NavGroupLinks
						key={child.id}
						group={child}
						linkClass={linkClass}
					/>
				))}
				{group.links.map(link => (
					<Link key={link.href} href={link.href} className={linkClass(link.href)}>
						{link.icon}
						{link.label}
					</Link>
				))}
			</div>
		</div>
	);
}

function ChipLink({
	href,
	label,
	icon,
	active,
}: NavLinkItem & { active: boolean }) {
	return (
		<Link
			href={href}
			className={cn(
				"inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
				active
					? "bg-primary text-primary-foreground shadow-sm"
					: "text-muted-foreground hover:bg-muted hover:text-foreground",
			)}>
			{icon}
			{label}
		</Link>
	);
}
