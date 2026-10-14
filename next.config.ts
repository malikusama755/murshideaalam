import type { NextConfig } from "next";
import legacyRedirects from "./legacy-redirects.json";

const nextConfig: NextConfig = {
  async redirects() {
    return legacyRedirects;
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
