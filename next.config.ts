import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@prisma/client',
    '@napi-rs/canvas',
    'pdfjs-dist',
  ],
};

export default nextConfig;
