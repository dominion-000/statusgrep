import type { APIRoute } from "astro";
import { getToken } from "../../../lib/auth";

export const GET: APIRoute = async ({ params, cookies, request }) => {
  const token = getToken(cookies);
  if (!token) return new Response("Unauthorized", { status: 401 });
  const projectId = params.projectId!;
  const base = (process.env.API_BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const upstream = await fetch(
    `${base}/api/v1/projects/${projectId}/events/status`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
    },
  );
  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text(), { status: upstream.status });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};
