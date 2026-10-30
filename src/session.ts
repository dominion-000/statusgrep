import type { Request, Response } from "express";
import type { UiConfig } from "./config.js";

export function readToken(req: Request, config: UiConfig): string | null {
  const raw = req.headers.cookie ?? "";
  const parts = raw.split(";").map((s) => s.trim());
  const prefix = `${config.sessionCookie}=`;
  for (const p of parts) {
    if (p.startsWith(prefix)) {
      return decodeURIComponent(p.slice(prefix.length)) || null;
    }
  }
  return null;
}

export function setToken(
  res: Response,
  config: UiConfig,
  token: string,
  maxAgeSec: number,
): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${config.sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`,
  );
}

export function clearToken(res: Response, config: UiConfig): void {
  res.setHeader(
    "Set-Cookie",
    `${config.sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}
