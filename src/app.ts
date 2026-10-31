import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import { loadConfig } from "./config.js";
import { buildRoutes } from "./routes.js";

export function createUiApp(): Express {
  const config = loadConfig();
  const app = express();
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.urlencoded({ extended: false }));
  app.use("/assets", express.static(path.join(root, "public")));
  app.use(buildRoutes(config));
  return app;
}
