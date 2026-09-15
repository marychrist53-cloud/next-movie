import type { NextConfig } from "next";

const developmentScriptPolicy =
	process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const securityHeaders = [
	{
		key: "X-Content-Type-Options",
		value: "nosniff",
	},
	{
		key: "X-Frame-Options",
		value: "DENY",
	},
	{
		key: "Referrer-Policy",
		value: "strict-origin-when-cross-origin",
	},
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=()",
	},
	{
		key: "Content-Security-Policy",
		value: [
			"default-src 'self'",
			`script-src 'self' 'unsafe-inline' 'unsafe-hashes'${developmentScriptPolicy}`,
			"style-src 'self' 'unsafe-inline' 'unsafe-hashes'",
			"img-src 'self' https://image.tmdb.org https://img.youtube.com data:",
			"media-src 'self'",
			"font-src 'self' data:",
			"frame-src https://www.youtube-nocookie.com https://www.youtube.com",
			"connect-src 'self' https://api.themoviedb.org",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
		].join("; "),
	},
];

const nextConfig: NextConfig = {
	images: {
		// TMDB already serves sized JPEGs. Vercel Hobby Image Optimization
		// (5k transforms/month) 402s new posters once the cap is hit.
		unoptimized: true,
		remotePatterns: [
			{
				protocol: "https",
				hostname: "image.tmdb.org",
				pathname: "/t/p/**",
			},
			{
				protocol: "https",
				hostname: "img.youtube.com",
				pathname: "/vi/**",
			},
		],
	},
	headers: async () => [
		{
			source: "/(.*)",
			headers: securityHeaders,
		},
	],
	redirects: async () => [
		{
			source: "/browse/anime/:origin/movies/theatrical-today",
			destination: "/browse/anime/:origin/release-today",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/movies/digital-today",
			destination: "/browse/anime/:origin/release-today",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/movies/now-playing",
			destination: "/browse/anime/:origin/release-today",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/movies/popular",
			destination: "/browse/anime/:origin/trending",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/movies/:category",
			destination: "/browse/anime/:origin/:category",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/tv/theatrical-today",
			destination: "/browse/anime/:origin/release-today",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/tv/digital-today",
			destination: "/browse/anime/:origin/release-today",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/tv/on-the-air",
			destination: "/browse/anime/:origin/release-today",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/tv/popular",
			destination: "/browse/anime/:origin/trending",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/tv/:category",
			destination: "/browse/anime/:origin/:category",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/theatrical-today",
			destination: "/browse/anime/:origin/release-today",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/digital-today",
			destination: "/browse/anime/:origin/release-today",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/now-playing",
			destination: "/browse/anime/:origin/release-today",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/on-the-air",
			destination: "/browse/anime/:origin/release-today",
			permanent: false,
		},
		{
			source: "/browse/anime/:origin/popular",
			destination: "/browse/anime/:origin/trending",
			permanent: false,
		},
	],
};

export default nextConfig;
