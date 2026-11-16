import type { Request, Response } from "express";
import { requireUser } from "../../middleware/authenticate";
import { sendSuccess } from "../../utils/response";
import * as aiService from "./ai.service";
import type { ChatInput } from "./ai.validation";

export async function chat(req: Request, res: Response): Promise<void> {
  requireUser(req); // only logged-in users may use the assistant
  sendSuccess(res, await aiService.chat(req.body as ChatInput));
}
