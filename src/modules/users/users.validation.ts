import { z } from "zod";

// strictObject: any field other than name/phone is rejected with 422 instead of silently ignored.
export const updateMeSchema = z
  .strictObject({
    name: z
      .string({ error: "Name must be text" })
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be at most 100 characters")
      .optional(),
    // null clears the phone number.
    phone: z
      .string({ error: "Phone must be text or null" })
      .trim()
      .regex(/^\+?[0-9][0-9\s-]{6,19}$/, "Enter a valid phone number, e.g. +8801712345678")
      .nullable()
      .optional(),
    // Listed only to give a clear message: the email is the login identity and cannot change.
    email: z.never({ error: "Email cannot be changed" }).optional(),
  })
  .refine((body) => body.name !== undefined || body.phone !== undefined, {
    message: "Send at least one of: name, phone",
    path: ["body"],
  });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
