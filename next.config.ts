import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  // The one version number, from package.json; SITE.version and the changelog read it.
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  images: {
    // Covers are stored in our own database and served from /api/attachments/*.
    // Remote URLs are rendered with a plain <img> (any host, validated as https on input).
    remotePatterns: [],
  },
  experimental: {
    serverActions: {
      // Cover uploads go through a route handler; keep action bodies small.
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
