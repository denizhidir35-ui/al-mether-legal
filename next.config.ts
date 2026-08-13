import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/uets/document-analyze": [
      "./eng.traineddata",
      "./tur.traineddata",
      "./node_modules/tesseract.js/package.json",
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/tesseract.js/node_modules/**/*",
      "./node_modules/bmp-js/**/*",
      "./node_modules/is-url/**/*",
      "./node_modules/regenerator-runtime/**/*",
      "./node_modules/wasm-feature-detect/**/*",
      "./node_modules/tesseract.js-core/**/*",
    ],
  },
  serverExternalPackages: [
    "@napi-rs/canvas",
    "pdfjs-dist",
    "tesseract.js",
    "tesseract.js-core",
  ],
  /* config options here */
};

export default nextConfig;
