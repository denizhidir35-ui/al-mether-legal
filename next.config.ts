import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@napi-rs/canvas",
    "pdfjs-dist",
    "tesseract.js",
    "tesseract.js-core",
  ],
  /* config options here */
};

export default nextConfig;
