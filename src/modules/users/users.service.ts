import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { publicUserSelect, type PublicUser } from "./users.types";
import type { UpdateMeInput } from "./users.validation";

// The token is valid but the account is gone: treat it like a bad session.
const accountMissing = (): ApiError => new ApiError(401, "Account not found. Please log in again.");

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw accountMissing();
  return user;
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<PublicUser> {
  await getMe(userId);
  return prisma.user.update({
    where: { id: userId },
    data: { name: input.name, phone: input.phone },
    select: publicUserSelect,
  });
}
