import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import { loadConfig } from "./config.js";
import { buildRoutes } from "./routes.js";

/** Project root (parent of dist/ or src/). */
export function projectRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function createUiApp(): Express {
  const config = loadConfig();
  const app = express();
  const root = projectRoot();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.urlencoded({ extended: false }));
  app.use("/assets", express.static(path.join(root, "public")));
  app.use(buildRoutes(config));

  app.get("/__health", (_req, res) => {
    res.json({ ok: true, root, apiBaseUrl: config.apiBaseUrl });
  });

  return app;
}
