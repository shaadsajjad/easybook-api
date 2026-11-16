import type { Request, Response } from "express";
import { requireUser } from "../../middleware/authenticate";
import { sendSuccess } from "../../utils/response";
import * as usersService from "./users.service";
import type { UpdateMeInput } from "./users.validation";

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await usersService.getMe(requireUser(req).id);
  sendSuccess(res, user);
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const user = await usersService.updateMe(requireUser(req).id, req.body as UpdateMeInput);
  sendSuccess(res, user, { message: "Profile updated" });
}
