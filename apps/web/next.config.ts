import type { NextConfig } from "next";

const apiOrigin = process.env.SHELLFORGE_API_ORIGIN ?? "http://127.0.0.1:8010";
const parsed = new URL(apiOrigin);
if (
  !["http:", "https:"].includes(parsed.protocol) ||
  parsed.username ||
  parsed.password ||
  parsed.pathname !== "/" ||
  parsed.search ||
  parsed.hash
) {
  throw new Error(
    "SHELLFORGE_API_ORIGIN must be an HTTP(S) origin without credentials or a path",
  );
}

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${parsed.origin}/api/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
