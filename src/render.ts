import path from "node:path";
import ejs from "ejs";
import type { Response } from "express";
import { projectRoot } from "./app.js";

export async function renderPage(
  res: Response,
  view: string,
  data: Record<string, unknown>,
): Promise<void> {
  const viewsRoot = path.join(projectRoot(), "views");
  const body = await ejs.renderFile(path.join(viewsRoot, `${view}.ejs`), data, {
    async: true,
  });
  const html = await ejs.renderFile(
    path.join(viewsRoot, "layouts/main.ejs"),
    { ...data, body },
    { async: true },
  );
  res.type("html").send(html);
}
