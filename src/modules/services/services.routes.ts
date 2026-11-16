import { Router } from "express";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as servicesController from "./services.controller";
import { availabilityQuerySchema, listServicesQuerySchema } from "./services.validation";

// Public: no login needed to browse services.
const router = Router();

router.get("/", validate({ query: listServicesQuerySchema }), asyncHandler(servicesController.list));
// Must be registered before "/:id", otherwise "categories" would be treated as an id.
router.get("/categories", asyncHandler(servicesController.categories));
router.get("/:id", asyncHandler(servicesController.detail));
router.get(
  "/:id/availability",
  validate({ query: availabilityQuerySchema }),
  asyncHandler(servicesController.availability),
);

export default router;
