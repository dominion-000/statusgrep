import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { loadConfig } from "./config.js";
import { buildRoutes } from "./routes.js";

const config = loadConfig();
const app = express();
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false }));
app.use("/assets", express.static(path.join(root, "public")));
app.use(buildRoutes(config));

app.listen(config.port, () => {
  console.log(
    `StatusGrep UI on :${config.port} → API ${config.apiBaseUrl}`,
  );
});
