import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@jobscout/core"],
  webpack: (config) => {
    // @jobscout/core uses NodeNext-style ".js" extensions in its TS source
    // (required by the worker's tsc build); teach webpack to resolve them.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"]
    };
    return config;
  }
};

export default nextConfig;
