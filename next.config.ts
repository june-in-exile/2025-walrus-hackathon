import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use Turbopack with empty config for default behavior
  // WASM support is built-in with Turbopack
  turbopack: {},

  // Keep webpack config as fallback for --webpack flag
  webpack: (config, { isServer }) => {
    // Enable WebAssembly support for @mysten/walrus SDK
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add WASM file handling
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    // Handle WASM imports in server-side code
    if (isServer) {
      config.output.webassemblyModuleFilename = "chunks/[id].wasm";
    }

    return config;
  },
};

export default nextConfig;
