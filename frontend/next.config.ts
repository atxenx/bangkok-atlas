import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep output tracing scoped to this app. A package-lock.json also exists in
  // the user's home directory and must never expand a production trace there.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
