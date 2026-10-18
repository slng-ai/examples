import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prefills the optional Project ID field (see .env.example).
  env: { SLNG_PROJECT_ID: process.env.SLNG_PROJECT_ID ?? "" },
};

export default nextConfig;
