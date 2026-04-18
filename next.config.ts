import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@prisma/client',
    'pdfjs-dist',
    '@napi-rs/canvas',
  ],
};

export default nextConfig;
