import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { aiLimiter } from "../../middleware/rateLimiters";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as aiController from "./ai.controller";
import { chatSchema } from "./ai.validation";

const router = Router();

// Login first, then the per-IP AI rate limit, then validation.
router.post("/chat", authenticate, aiLimiter, validate({ body: chatSchema }), asyncHandler(aiController.chat));

export default router;
