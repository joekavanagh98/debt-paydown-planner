import { defineConfig } from "vitest/config";

// Vitest reads this file for test-only configuration. The env block
// injects MONGODB_URI before any test code (or src/config/env.ts)
// loads, so the env schema validates and tests boot. The placeholder
// is overwritten in commit (v6 storage wire-up) by mongodb-memory-server,
// which spins an ephemeral Mongo per test run and replaces this URI
// dynamically.
export default defineConfig({
  test: {
    env: {
      MONGODB_URI: "mongodb://placeholder/test",
    },
  },
});
