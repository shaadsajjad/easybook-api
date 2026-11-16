import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`EasyBook API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Render sends SIGTERM on deploys/restarts: finish open requests, then close the DB pool.
function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    prisma
      .$disconnect()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
