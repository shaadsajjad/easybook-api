import { z } from "zod";

const uuidSchema = z.uuid();

// Used for ids in the URL path: a malformed id simply means "not found" (404), not a 422.
export function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}
