import { Router } from "express";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as authController from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.validation";

const router = Router();

router.post("/register", validate({ body: registerSchema }), asyncHandler(authController.register));
router.post("/login", validate({ body: loginSchema }), asyncHandler(authController.login));

export default router;
