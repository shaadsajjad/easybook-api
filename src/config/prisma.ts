import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// One shared client for the whole app. Prisma manages its own connection pool.
// Tests trigger database errors on purpose, so Prisma's own error logging is off there.
export const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["warn", "error"] : env.NODE_ENV === "production" ? ["error"] : [],
});
