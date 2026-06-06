import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["googleapis"],
  outputFileTracingIncludes: {
    "/*": ["./data/index.json"]
  }
};

export default nextConfig;
