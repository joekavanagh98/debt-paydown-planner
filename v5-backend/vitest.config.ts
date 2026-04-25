import { defineConfig } from "vitest/config";

// Vitest reads this file for test-only configuration. The env block
// injects MONGODB_URI before any test code (or src/config/env.ts)
// loads, so the env schema validates at import time. The actual
// Mongo connection used during tests is owned by setupMongo.ts,
// which spins an ephemeral mongodb-memory-server and connects
// mongoose to it. Tests don't read env.MONGODB_URI — they rely on
// the open Mongoose connection that setupMongo establishes.
export default defineConfig({
  test: {
    setupFiles: ["./src/test/setupMongo.ts"],
    env: {
      MONGODB_URI: "mongodb://placeholder/test",
    },
  },
});
