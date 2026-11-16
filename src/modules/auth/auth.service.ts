import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { publicUserSelect } from "../users/users.types";
import { INVALID_CREDENTIALS_MESSAGE, type AuthResult } from "./auth.types";
import type { LoginInput, RegisterInput } from "./auth.validation";

export function signToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    algorithm: "HS256",
    // jsonwebtoken types expect a template-literal type like "7d"; env validation keeps it a string.
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  try {
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: publicUserSelect,
    });
    return { user, token: signToken(user.id) };
  } catch (error) {
    // Two sign-ups with the same email at the same moment: the unique index catches the second.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "An account with this email already exists");
    }
    throw error;
  }
}

// A real bcrypt hash of a random value, used when the email does not exist so that
// "unknown email" takes as long as "wrong password" (no timing hint either).
let dummyHash: string | undefined;
async function getDummyHash(): Promise<string> {
  dummyHash ??= await bcrypt.hash("dummy-password-for-timing", env.BCRYPT_ROUNDS);
  return dummyHash;
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !passwordMatches) {
    throw new ApiError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  const { passwordHash: _passwordHash, ...publicUser } = user;
  return { user: publicUser, token: signToken(user.id) };
}
