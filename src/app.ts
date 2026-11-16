import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { generalLimiter } from "./middleware/rateLimiters";
import routes from "./routes";

// Builds the Express app without starting a server, so tests can import it directly.
export function createApp(): Express {
  const app = express();

  // Render puts one proxy in front of the app; this lets rate limiting see the real client IP.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    }),
  );
  app.use(express.json({ limit: "10kb" }));

  app.use("/api/v1", generalLimiter, routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
