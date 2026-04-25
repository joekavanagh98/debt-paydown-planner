import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Connect Mongoose to the configured MongoDB. Called once at boot
 * from server.ts before the HTTP listener starts taking requests.
 *
 * Mongoose buffers operations until the connection is open, so a
 * request that arrived before connect() resolved would silently
 * stall. Awaiting the connect at boot prevents that race.
 */
export async function connectMongo(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  logger.info("MongoDB connected");
}

/**
 * Close the connection. Called from the SIGTERM/SIGINT handlers in
 * server.ts during graceful shutdown so in-flight queries can finish
 * and the driver can release sockets cleanly.
 */
export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
  logger.info("MongoDB disconnected");
}
