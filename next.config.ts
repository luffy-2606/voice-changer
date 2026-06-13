import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // FIX 2 — Polyfill / stub Node.js built-ins that leak into the browser bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        buffer: false,
      };

      // FIX 3 — Explicitly block onnxruntime-node from entering the browser bundle.
      // kokoro-js ships its own onnxruntime-web; the Node variant must never be resolved.
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-node": false,
        "onnxruntime-node/bin/napi-v3": false,
      };
    }

    return config;
  },
};

export default nextConfig;