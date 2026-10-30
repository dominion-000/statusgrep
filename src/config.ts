import "dotenv/config";

export interface UiConfig {
  apiBaseUrl: string;
  port: number;
  sessionCookie: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): UiConfig {
  const apiBaseUrl = (env.API_BASE_URL ?? "http://127.0.0.1:3000").replace(
    /\/$/,
    "",
  );
  const port = Number(env.PORT ?? 4000);
  return {
    apiBaseUrl,
    port: Number.isFinite(port) && port > 0 ? port : 4000,
    sessionCookie: env.SESSION_COOKIE?.trim() || "sg_token",
  };
}
