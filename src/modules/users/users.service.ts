import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { publicUserSelect, type PublicUser } from "./users.types";
import type { ChangePasswordInput, UpdateMeInput } from "./users.validation";

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

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw accountMissing();

  // 422 (not 401): a wrong current password is a form error, it must not log the user out.
  const matches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!matches) {
    throw new ApiError(422, "Current password is incorrect", [
      { field: "currentPassword", message: "Current password is incorrect" },
    ]);
  }

  const passwordHash = await bcrypt.hash(input.newPassword, env.BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
