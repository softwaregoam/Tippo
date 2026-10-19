import type { NextConfig } from "next";
import { validateDevelopmentEnvironment } from "./scripts/development-environment.mjs";

validateDevelopmentEnvironment(process.env);

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
