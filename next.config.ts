import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  // Playwright's webServer runs a second `next dev`/`next start` from this same directory.
  // Next 16 locks `<distDir>/lock` per directory (see experimental.lockDistDir), so give the
  // e2e server its own distDir instead of disabling that lock.
  distDir: process.env.NEXT_DIST_DIR,
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
