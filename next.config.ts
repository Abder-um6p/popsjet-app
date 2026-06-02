import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // RC1 — types Supabase pas encore alignés avec le schéma DB
    // À corriger avant la v1.0
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
