import { z } from "zod";

/**
 * Single source of truth for every environment variable the app reads.
 * The schema runs once at module load. If any value is missing or
 * malformed, the process exits with a readable diagnostic instead of
 * crashing later inside whichever middleware first reaches for the
 * variable.
 *
 * Defaults exist where running the dev server without an .env file
 * should Just Work. Production deployments override these via real
 * env vars; the schema still validates the override.
 */
const envSchema = z.object({
  // process.env values are always strings; z.coerce.number bridges that.
  PORT: z.coerce.number().int().positive().default(3001),

  // No default. The dev server requires a real Mongo URI to start.
  // mongodb-memory-server provides one for tests via setup hooks, so
  // tests don't need MONGODB_URI in the shell environment either.
  MONGODB_URI: z.string().min(1),

  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),

  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  // Boot-time failure: pino isn't loaded yet (it depends on this
  // module). Write the diagnostic to stderr and exit non-zero.
  console.error("Invalid environment configuration:");
  console.error(JSON.stringify(result.error.format(), null, 2));
  process.exit(1);
}

export const env = result.data;
