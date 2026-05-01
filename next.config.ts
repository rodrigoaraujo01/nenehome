import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/nenehome",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
