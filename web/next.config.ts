import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Vault is read at runtime from VAULT_PATH (Docker volume).
  outputFileTracingIncludes: {
    "/*": ["./content/help/**/*"],
  },
};

export default nextConfig;
