import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // pdfkit loads its own data files, so keep it out of the server bundle
  serverExternalPackages: ["pdfkit"],
  // the PDF export reads the Thai font from public/fonts at runtime: make sure deployments ship it
  outputFileTracingIncludes: {
    "/api/export": ["./public/fonts/**/*"],
  },
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