import type { APIRoute } from "astro";
import { clearToken } from "../lib/auth";

export const GET: APIRoute = ({ cookies, redirect }) => {
  clearToken(cookies);
  return redirect("/");
};
