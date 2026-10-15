import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    // W katalogu domowym leży inny package-lock.json; bez tego Next bierze zły root.
    root: path.join(__dirname),
  },
};

export default nextConfig;
