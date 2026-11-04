import type { AstroCookies } from "astro";

export const TOKEN_COOKIE = "sg_token";

export function getToken(cookies: AstroCookies): string | null {
  return cookies.get(TOKEN_COOKIE)?.value ?? null;
}

export function setToken(cookies: AstroCookies, token: string) {
  cookies.set(TOKEN_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    maxAge: 60 * 60 * 12,
  });
}

export function clearToken(cookies: AstroCookies) {
  cookies.delete(TOKEN_COOKIE, { path: "/" });
}
