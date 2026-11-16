import { Router } from "express";
import { authLimiter } from "./middleware/rateLimiters";
import aiRoutes from "./modules/ai/ai.routes";
import appointmentsRoutes from "./modules/appointments/appointments.routes";
import authRoutes from "./modules/auth/auth.routes";
import healthRoutes from "./modules/health/health.routes";
import servicesRoutes from "./modules/services/services.routes";
import usersRoutes from "./modules/users/users.routes";

// Every feature router is mounted here, under /api/v1 (see app.ts).
const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authLimiter, authRoutes);
router.use("/users", usersRoutes);
router.use("/services", servicesRoutes);
router.use("/appointments", appointmentsRoutes);
router.use("/ai", aiRoutes);

export default router;
