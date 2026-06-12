import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Fallback for node modules imported by Transformers.js / ONNX Runtime Web
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        perf_hooks: false,
      };
    }
    return config;
  },
};

export default nextConfig;
