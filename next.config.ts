import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Enable server-side SDK usage in API routes
    serverExternalPackages: ["@fullsailfinance/sdk"],
};

export default nextConfig;
