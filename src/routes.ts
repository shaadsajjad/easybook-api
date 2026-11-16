import { Router } from "express";
import { authLimiter } from "./middleware/rateLimiters";
import authRoutes from "./modules/auth/auth.routes";
import healthRoutes from "./modules/health/health.routes";
import usersRoutes from "./modules/users/users.routes";

// Every feature router is mounted here, under /api/v1 (see app.ts).
const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authLimiter, authRoutes);
router.use("/users", usersRoutes);

export default router;
