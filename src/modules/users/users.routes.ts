import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as usersController from "./users.controller";
import { updateMeSchema } from "./users.validation";

const router = Router();

router.use(authenticate);

router.get("/me", asyncHandler(usersController.getMe));
router.patch("/me", validate({ body: updateMeSchema }), asyncHandler(usersController.updateMe));

export default router;
