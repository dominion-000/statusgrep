import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ejs from "ejs";
import type { Response } from "express";

function candidateRoots(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/render.js → .. = project root; also try cwd (Vercel /var/task)
  return [
    path.resolve(here, ".."),
    process.cwd(),
    path.resolve(process.cwd(), ".."),
  ];
}

export function resolveViewsRoot(): string {
  for (const root of candidateRoots()) {
    const views = path.join(root, "views");
    if (fs.existsSync(path.join(views, "layouts", "main.ejs"))) {
      return views;
    }
  }
  throw new Error(
    `views/layouts/main.ejs not found; tried: ${candidateRoots().join(", ")}`,
  );
}

export async function renderPage(
  res: Response,
  view: string,
  data: Record<string, unknown>,
): Promise<void> {
  const viewsRoot = resolveViewsRoot();
  const viewPath = path.join(viewsRoot, `${view}.ejs`);
  if (!fs.existsSync(viewPath)) {
    throw new Error(`View not found: ${viewPath}`);
  }
  const body = await ejs.renderFile(viewPath, data, { async: true });
  const html = await ejs.renderFile(
    path.join(viewsRoot, "layouts/main.ejs"),
    { ...data, body },
    { async: true },
  );
  res.type("html").send(html);
}
