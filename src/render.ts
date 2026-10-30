import path from "node:path";
import { fileURLToPath } from "node:url";
import ejs from "ejs";
import type { Response } from "express";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "views");

export async function renderPage(
  res: Response,
  view: string,
  data: Record<string, unknown>,
): Promise<void> {
  const body = await ejs.renderFile(path.join(root, `${view}.ejs`), data, {
    async: true,
  });
  const html = await ejs.renderFile(
    path.join(root, "layouts/main.ejs"),
    { ...data, body },
    { async: true },
  );
  res.type("html").send(html);
}
