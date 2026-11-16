import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { afterAll } from "vitest";

// Runs before every test file (vitest setupFiles), BEFORE the app or env.ts is imported.
// Tests delete data, so we refuse to run unless we are certain this is a separate test database.

const testEnvPath = path.resolve(process.cwd(), ".env.test");
const devEnvPath = path.resolve(process.cwd(), ".env");

if (!fs.existsSync(testEnvPath)) {
  throw new Error("Missing .env.test. Copy .env.test.example to .env.test and point it at a TEST database.");
}

dotenv.config({ path: testEnvPath, override: true, quiet: true });

if (process.env.NODE_ENV !== "test") {
  throw new Error(`Refusing to run tests: NODE_ENV is "${process.env.NODE_ENV}", expected "test".`);
}

if (fs.existsSync(devEnvPath)) {
  const devEnv = dotenv.parse(fs.readFileSync(devEnvPath));
  for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
    if (devEnv[key] && devEnv[key] === process.env[key]) {
      throw new Error(`Refusing to run tests: ${key} in .env.test is the same as in .env (dev database).`);
    }
  }
}

// Close the DB pool after each test file so the run exits cleanly.
// Imported lazily so the checks above always run before any database code loads.
afterAll(async () => {
  const { prisma } = await import("../config/prisma");
  await prisma.$disconnect();
});
