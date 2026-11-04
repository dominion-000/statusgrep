import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const base = (process.env.API_BASE_URL || "").replace(/\/$/, "");
  if (!base) {
    return new Response(JSON.stringify({ ok: false, reason: "no API_BASE_URL" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    return new Response(JSON.stringify({ ok: r.ok, status: r.status }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
