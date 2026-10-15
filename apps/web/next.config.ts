import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app lives in a monorepo-like folder; pin the workspace root to this app.
  turbopack: {
    root: path.join(__dirname),
  },
  // Earlier page structure -> current navigation (Overview · Compare Models · Results · Hybrid Demo · Methodology).
  // /compare is now the three-model flagship page and is no longer redirected.
  async redirects() {
    return [
      { source: "/lab", destination: "/results", permanent: false },
      { source: "/guided", destination: "/", permanent: false },
      { source: "/guided/:stage", destination: "/", permanent: false },
      { source: "/simulator", destination: "/demo", permanent: false },
      { source: "/explain", destination: "/demo", permanent: false },
      { source: "/projected", destination: "/demo", permanent: false },
    ];
  },
};

export default nextConfig;
