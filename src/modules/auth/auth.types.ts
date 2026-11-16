import type { PublicUser } from "../users/users.types";

export interface AuthResult {
  user: PublicUser;
  token: string;
}

// Same message for "unknown email" and "wrong password", so attackers cannot
// find out which emails have accounts (user enumeration).
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";
