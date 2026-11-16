import type { Request, Response } from "express";
import { sendSuccess } from "../../utils/response";
import * as authService from "./auth.service";
import type { LoginInput, RegisterInput } from "./auth.validation";

// req.body has already been validated and cleaned by the validate middleware.

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body as RegisterInput);
  sendSuccess(res, result, { status: 201, message: "Account created" });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body as LoginInput);
  sendSuccess(res, result, { message: "Logged in" });
}
