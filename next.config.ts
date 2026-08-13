import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/uets/document-analyze": [
      "./eng.traineddata",
      "./tur.traineddata",
      "./node_modules/tesseract.js/src/worker-script/node/**/*",
      "./node_modules/tesseract.js-core/*.js",
      "./node_modules/tesseract.js-core/*.wasm",
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
