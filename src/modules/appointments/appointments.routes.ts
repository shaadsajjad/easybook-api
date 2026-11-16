import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as appointmentsController from "./appointments.controller";
import { createAppointmentSchema, listAppointmentsQuerySchema } from "./appointments.validation";

const router = Router();

router.use(authenticate);

router.post("/", validate({ body: createAppointmentSchema }), asyncHandler(appointmentsController.create));
router.get("/", validate({ query: listAppointmentsQuerySchema }), asyncHandler(appointmentsController.list));
router.get("/:id", asyncHandler(appointmentsController.detail));
router.patch("/:id/cancel", asyncHandler(appointmentsController.cancel));

export default router;
