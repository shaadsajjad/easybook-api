import dotenv from "dotenv";
import { z } from "zod";

// In tests, src/tests/setup.ts has already loaded .env.test. Never fall back to .env there.
if (process.env.NODE_ENV !== "test") {
  dotenv.config({ quiet: true });
}

const postgresUrl = z
  .string()
  .regex(/^postgres(ql)?:\/\//, "must be a postgres:// connection string");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),

    DATABASE_URL: postgresUrl,
    DIRECT_URL: postgresUrl,

    JWT_SECRET: z.string().min(32, "must be at least 32 characters"),
    JWT_EXPIRES_IN: z.string().min(1).default("7d"),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

    CORS_ORIGIN: z.string().min(1).default("*"),

    // Optional so the API can boot without it; the AI endpoint returns 503 when it is missing.
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),

    BUSINESS_TIMEZONE: z
      .string()
      .min(1)
      .default("Asia/Dhaka")
      .refine(isValidTimeZone, "must be a valid IANA time zone, e.g. Asia/Dhaka"),
    BUSINESS_OPEN_HOUR: z.coerce.number().int().min(0).max(23).default(9),
    BUSINESS_CLOSE_HOUR: z.coerce.number().int().min(1).max(24).default(18),
    SLOT_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
  })
  .refine((e) => e.BUSINESS_CLOSE_HOUR > e.BUSINESS_OPEN_HOUR, {
    message: "BUSINESS_CLOSE_HOUR must be later than BUSINESS_OPEN_HOUR",
    path: ["BUSINESS_CLOSE_HOUR"],
  });

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Print only variable names and problems, never the values (they may be secrets).
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    console.error(`Invalid environment variables:\n${problems}`);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
