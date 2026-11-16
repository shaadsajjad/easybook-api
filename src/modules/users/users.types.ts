import type { Prisma } from "@prisma/client";

// The only user fields the API ever returns. passwordHash is never selected,
// so it cannot leak into a response by accident.
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
