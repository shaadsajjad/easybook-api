import { z } from "zod";
import { isValidDateString } from "../../utils/time";
import { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from "./services.types";

// Query strings always arrive as text, so numbers and booleans are coerced here.
const optionalText = (max: number) =>
  z
    .string({ error: "Must be text" })
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .transform((value) => value || undefined); // "" means "no filter"

const price = z.coerce
  .number({ error: "Must be a number" })
  .nonnegative("Must be 0 or more")
  .optional();

export const listServicesQuerySchema = z
  .object({
    search: optionalText(100),
    category: optionalText(50),
    featured: z
      .enum(["true", "false"], { error: 'Must be "true" or "false"' })
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
    minPrice: price,
    maxPrice: price,
    page: z.coerce.number({ error: "Must be a number" }).int("Must be a whole number").min(1, "Must be 1 or more").default(1),
    limit: z.coerce
      .number({ error: "Must be a number" })
      .int("Must be a whole number")
      .min(1, "Must be 1 or more")
      .max(MAX_PAGE_SIZE, `Must be at most ${MAX_PAGE_SIZE}`)
      .default(DEFAULT_PAGE_SIZE),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: "maxPrice must be greater than or equal to minPrice",
    path: ["maxPrice"],
  });

export const availabilityQuerySchema = z.object({
  date: z
    .string({ error: "Date is required (YYYY-MM-DD)" })
    .refine(isValidDateString, "Date must be a real date in the format YYYY-MM-DD"),
});

export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
