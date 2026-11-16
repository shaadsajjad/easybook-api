import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// One shared client for the whole app. Prisma manages its own connection pool.
export const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
