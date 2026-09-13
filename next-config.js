/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self' https: data 'unsafe-eval' 'unsafe-hashes'; script-src 'self' 'unsafe-eval' 'unsafe-hashes' https; style-src 'self' 'unsafe-eval' 'unsafe-hashes' https;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;