import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";

/**
 * Per-test-file lifecycle hooks for an ephemeral MongoDB. Vitest runs
 * this file before each test file (configured via setupFiles in
 * vitest.config.ts) so each file gets its own in-memory server.
 *
 * The downloaded Mongo binary is cached after the first run; later
 * runs reuse it. afterEach clears every collection so test cases
 * never see each other's data without needing a manual reset hook
 * in the service.
 */

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
});
