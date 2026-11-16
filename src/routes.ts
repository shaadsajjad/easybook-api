import { Router } from "express";
import healthRoutes from "./modules/health/health.routes";

// Every feature router is mounted here, under /api/v1 (see app.ts).
const router = Router();

router.use("/health", healthRoutes);

export default router;
