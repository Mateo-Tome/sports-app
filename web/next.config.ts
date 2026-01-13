import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Force Turbopack to treat /web as the project root
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
