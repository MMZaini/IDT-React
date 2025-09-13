import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set the root used by output file tracing to the project directory
  // This silences warnings when multiple lockfiles exist on the machine.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
