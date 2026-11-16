import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authLimiter } from "../../middleware/rateLimiters";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as usersController from "./users.controller";
import { changePasswordSchema, updateMeSchema } from "./users.validation";

const router = Router();

router.use(authenticate);

router.get("/me", asyncHandler(usersController.getMe));
router.patch("/me", validate({ body: updateMeSchema }), asyncHandler(usersController.updateMe));
// Same strict limit as login: stops someone with a stolen token from guessing the current password.
router.patch(
  "/me/password",
  authLimiter,
  validate({ body: changePasswordSchema }),
  asyncHandler(usersController.changePassword),
);

export default router;
