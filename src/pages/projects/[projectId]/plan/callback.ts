import type { APIRoute } from "astro";
import { api } from "../../../../lib/api";
import { getToken } from "../../../../lib/auth";

export const GET: APIRoute = async ({ params, url, cookies, redirect }) => {
  const token = getToken(cookies);
  if (!token) return redirect("/login");
  const projectId = params.projectId!;
  const reference = url.searchParams.get("reference") || "";
  if (!reference) {
    return redirect(
      `/projects/${projectId}/plans?error=${encodeURIComponent("Missing payment reference")}`,
    );
  }
  try {
    await api(`/api/v1/projects/${projectId}/plan/complete`, {
      method: "POST",
      token,
      body: { reference },
    });
    return redirect(`/projects/${projectId}/plans?ok=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Payment complete failed";
    return redirect(
      `/projects/${projectId}/plans?error=${encodeURIComponent(msg)}`,
    );
  }
};
