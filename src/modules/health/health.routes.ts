import { Router } from "express";
import { sendSuccess } from "../../utils/response";

const router = Router();

// GET /api/v1/health: used by Render's health check and to wake the service up.
router.get("/", (_req, res) => {
  sendSuccess(res, { status: "ok", uptime: Math.round(process.uptime()) });
});

export default router;
