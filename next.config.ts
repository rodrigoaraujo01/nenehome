import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/nenehome",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
