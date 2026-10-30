import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import type { UiConfig } from "./config.js";
import { ApiError, createApiClient } from "./api.js";
import { clearToken, readToken, setToken } from "./session.js";
import { renderPage } from "./render.js";

function body(req: Request): Record<string, string> {
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
    if (typeof v === "boolean") out[k] = v ? "true" : "false";
    else out[k] = String(v ?? "");
  }
  return out;
}

function projectSide(projectId: string, active: string) {
  return [
    { href: `/projects/${projectId}`, label: "Overview", active: active === "overview" },
    { href: `/projects/${projectId}/incidents`, label: "Incidents", active: active === "incidents" },
    { href: `/projects/${projectId}/alerts`, label: "Alerts", active: active === "alerts" },
    { href: `/projects/${projectId}/members`, label: "Members", active: active === "members" },
    { href: `/projects/${projectId}/plan`, label: "Plan", active: active === "plan" },
  ];
}

function nav(active: string, isAdmin: boolean) {
  const items = [
    { href: "/projects", label: "Projects", active: active === "projects" },
  ];
  if (isAdmin) {
    items.push({ href: "/admin", label: "Admin", active: active === "admin" });
  }
  items.push({ href: "/logout", label: "Sign out", active: false });
  return items;
}

type AuthUser = { id: string; email: string; name: string | null; isAdmin?: boolean };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailCookie(config: UiConfig) {
  return `${config.sessionCookie}_email`;
}
function adminCookie(config: UiConfig) {
  return `${config.sessionCookie}_admin`;
}
function readEmail(req: Request, config: UiConfig): string | null {
  const raw = req.headers.cookie ?? "";
  const prefix = `${emailCookie(config)}=`;
  for (const p of raw.split(";").map((s) => s.trim())) {
    if (p.startsWith(prefix)) return decodeURIComponent(p.slice(prefix.length));
  }
  return null;
}
function setEmail(res: Response, config: UiConfig, email: string) {
  res.append(
    "Set-Cookie",
    `${emailCookie(config)}=${encodeURIComponent(email)}; Path=/; SameSite=Lax; Max-Age=28800`,
  );
}
function clearEmail(res: Response, config: UiConfig) {
  res.append("Set-Cookie", `${emailCookie(config)}=; Path=/; Max-Age=0`);
}
function readAdminFlag(req: Request, config: UiConfig): boolean {
  const raw = req.headers.cookie ?? "";
  const prefix = `${adminCookie(config)}=`;
  for (const p of raw.split(";").map((s) => s.trim())) {
    if (p.startsWith(prefix)) return p.slice(prefix.length) === "1";
  }
  return false;
}
function setAdminFlag(res: Response, config: UiConfig, isAdmin: boolean) {
  res.append(
    "Set-Cookie",
    `${adminCookie(config)}=${isAdmin ? "1" : "0"}; Path=/; SameSite=Lax; Max-Age=28800`,
  );
}
function clearAdminFlag(res: Response, config: UiConfig) {
  res.append("Set-Cookie", `${adminCookie(config)}=; Path=/; Max-Age=0`);
}

function flash(req: Request): string | null {
  return typeof req.query.error === "string"
    ? req.query.error
    : typeof req.query.msg === "string"
      ? req.query.msg
      : null;
}

export function buildRoutes(config: UiConfig): Router {
  const r = Router();

  function api(req: Request) {
    return createApiClient(config, readToken(req, config));
  }

  async function requireUser(req: Request): Promise<AuthUser | null> {
    const token = readToken(req, config);
    if (!token) return null;
    try {
      await createApiClient(config, token).get("/api/v1/projects");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
    }
    const email = readEmail(req, config);
    if (!email) return null;
    return { id: "", email, name: null, isAdmin: readAdminFlag(req, config) };
  }

  async function requireAdmin(req: Request, res: Response): Promise<AuthUser | null> {
    const user = await requireUser(req);
    if (!user) {
      res.redirect("/login");
      return null;
    }
    if (!user.isAdmin) {
      res.status(403).type("html").send("Forbidden");
      return null;
    }
    return user;
  }

  r.get("/", (req, res) => {
    if (readToken(req, config)) return res.redirect("/projects");
    return res.redirect("/login");
  });

  r.get("/login", async (_req, res) => {
    await renderPage(res, "auth/login", {
      title: "Log in",
      error: null,
      email: "",
      brandHref: "/",
      nav: [],
      authPage: true,
    });
  });

  r.post("/login", async (req, res, next) => {
    try {
      const b = body(req);
      const data = await createApiClient(config, null).post<{
        accessToken: string;
        expiresIn: number;
        user: AuthUser;
      }>("/api/v1/auth/login", { email: b.email, password: b.password });
      setToken(res, config, data.accessToken, data.expiresIn ?? 28800);
      setEmail(res, config, data.user.email);
      setAdminFlag(res, config, Boolean(data.user.isAdmin));
      res.redirect("/projects");
    } catch (err) {
      if (err instanceof ApiError) {
        await renderPage(res, "auth/login", {
          title: "Log in",
          error: err.message,
          email: body(req).email,
          brandHref: "/",
          nav: [],
          authPage: true,
        });
        return;
      }
      next(err);
    }
  });

  r.get("/register", async (_req, res) => {
    await renderPage(res, "auth/register", {
      title: "Register",
      error: null,
      email: "",
      name: "",
      brandHref: "/",
      nav: [],
      authPage: true,
    });
  });

  r.post("/register", async (req, res, next) => {
    try {
      const b = body(req);
      const data = await createApiClient(config, null).post<{
        accessToken: string;
        expiresIn: number;
        user: AuthUser;
      }>("/api/v1/auth/register", {
        email: b.email,
        password: b.password,
        name: b.name || null,
      });
      setToken(res, config, data.accessToken, data.expiresIn ?? 28800);
      setEmail(res, config, data.user.email);
      setAdminFlag(res, config, Boolean(data.user.isAdmin));
      res.redirect("/projects");
    } catch (err) {
      if (err instanceof ApiError) {
        await renderPage(res, "auth/register", {
          title: "Register",
          error: err.message,
          email: body(req).email,
          name: body(req).name,
          brandHref: "/",
          nav: [],
          authPage: true,
        });
        return;
      }
      next(err);
    }
  });

  r.get("/logout", (_req, res) => {
    clearToken(res, config);
    clearEmail(res, config);
    clearAdminFlag(res, config);
    res.redirect("/login");
  });

  // —— Projects ——
  r.get("/projects", async (req, res, next) => {
    try {
      const user = await requireUser(req);
      if (!user) return res.redirect("/login");
      const data = await api(req).get<{
        projects: Array<{ id: string; name: string; slug: string; role: string }>;
      }>("/api/v1/projects");
      await renderPage(res, "app/projects", {
        title: "Projects",
        user: { email: user.email },
        projects: data.projects ?? [],
        formError: flash(req),
        brandHref: "/projects",
        nav: nav("projects", Boolean(user.isAdmin)),
      });
    } catch (err) {
      next(err);
    }
  });

  r.post("/projects", async (req, res, next) => {
    try {
      const user = await requireUser(req);
      if (!user) return res.redirect("/login");
      const b = body(req);
      await api(req).post("/api/v1/projects", {
        name: b.name,
        slug: b.slug || undefined,
      });
      res.redirect("/projects");
    } catch (err) {
      if (err instanceof ApiError) {
        res.redirect(`/projects?error=${encodeURIComponent(err.message)}`);
        return;
      }
      next(err);
    }
  });

  r.get("/projects/:projectId", async (req, res, next) => {
    try {
      const user = await requireUser(req);
      if (!user) return res.redirect("/login");
      const id = req.params.projectId!;
      const project = await api(req).get<{
        id: string;
        name: string;
        slug: string;
      }>(`/api/v1/projects/${id}`);
      const servicesRes = await api(req).get<{
        services: Array<{
          id: string;
          name: string;
          url: string;
          intervalSeconds: number;
          enabled: boolean;
          currentStatus?: string;
        }>;
      }>(`/api/v1/projects/${id}/services`);
      const services = (servicesRes.services ?? []).map((s) => ({
        ...s,
        status: s.currentStatus ?? "Unknown",
      }));
      await renderPage(res, "app/project", {
        title: project.name,
        user: { email: user.email },
        project,
        services,
        error: flash(req),
        brandHref: "/projects",
        nav: nav("projects", Boolean(user.isAdmin)),
        sideTitle: project.name,
        sideNav: projectSide(id, "overview"),
      });
    } catch (err) {
      next(err);
    }
  });

  r.post("/projects/:projectId/services", async (req, res, next) => {
    try {
      const user = await requireUser(req);
      if (!user) return res.redirect("/login");
      const id = req.params.projectId!;
      const b = body(req);
      await api(req).post(`/api/v1/projects/${id}/services`, {
        name: b.name,
        url: b.url,
        intervalSeconds: Number(b.intervalSeconds || 60),
        timeoutSeconds: Number(b.timeoutSeconds || 10),
      });
      res.redirect(`/projects/${id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        res.redirect(
          `/projects/${req.params.projectId}?error=${encodeURIComponent(err.message)}`,
        );
        return;
      }
      next(err);
    }
  });

  // —— Service detail / edit / enable / override ——
  r.get("/projects/:projectId/services/:serviceId", async (req, res, next) => {
    try {
      const user = await requireUser(req);
      if (!user) return res.redirect("/login");
      const { projectId, serviceId } = req.params;
      const { service } = await api(req).get<{ service: Record<string, unknown> }>(
        `/api/v1/projects/${projectId}/services/${serviceId}`,
      );
      let status: Record<string, unknown> = {};
      try {
        status = await api(req).get(
          `/api/v1/projects/${projectId}/services/${serviceId}/status`,
        );
      } catch {
        /* */
      }
      let results: unknown[] = [];
      try {
        const rr = await api(req).get<{ results?: unknown[] }>(
          `/api/v1/projects/${projectId}/services/${serviceId}/results?limit=20`,
        );
        results = rr.results ?? [];
      } catch {
        /* */
      }
      let history: unknown[] = [];
      try {
        const h = await api(req).get<{ history?: unknown[] }>(
          `/api/v1/projects/${projectId}/services/${serviceId}/status/history?limit=20`,
        );
        history = h.history ?? [];
      } catch {
        /* */
      }
      await renderPage(res, "app/service", {
        title: String(service.name ?? "Service"),
        user: { email: user.email },
        projectId,
        service,
        status,
        results,
        history,
        error: flash(req),
        brandHref: "/projects",
        nav: nav("projects", Boolean(user.isAdmin)),
      });
    } catch (err) {
      next(err);
    }
  });

  r.get("/projects/:projectId/services/:serviceId/edit", async (req, res, next) => {
    try {
      const user = await requireUser(req);
      if (!user) return res.redirect("/login");
      const { projectId, serviceId } = req.params;
      const { service } = await api(req).get<{ service: Record<string, unknown> }>(
        `/api/v1/projects/${projectId}/services/${serviceId}`,
      );
      await renderPage(res, "app/service-edit", {
        title: "Edit service",
        user: { email: user.email },
        projectId,
        service,
        error: flash(req),
        brandHref: "/projects",
        nav: nav("projects", Boolean(user.isAdmin)),
      });
    } catch (err) {
      next(err);
    }
  });

  r.post("/projects/:projectId/services/:serviceId/edit", async (req, res, next) => {
    try {
      const user = await requireUser(req);
      if (!user) return res.redirect("/login");
      const { projectId, serviceId } = req.params;
      const b = body(req);
      const patch: Record<string, unknown> = {
        name: b.name,
        url: b.url,
        method: b.method || "GET",
        intervalSeconds: Number(b.intervalSeconds),
        timeoutSeconds: Number(b.timeoutSeconds),
        isPublic: b.isPublic === "true" || b.isPublic === "on",
      };
      if (b.expectedStatusCodes) {
        patch.expectedStatusCodes = b.expectedStatusCodes
          .split(",")
          .map((x) => Number(x.trim()))
          .filter((n) => Number.isFinite(n));
      }
      await api(req).patch(
        `/api/v1/projects/${projectId}/services/${serviceId}`,
        patch,
      );
      res.redirect(`/projects/${projectId}/services/${serviceId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        res.redirect(
          `/projects/${req.params.projectId}/services/${req.params.serviceId}/edit?error=${encodeURIComponent(err.message)}`,
        );
        return;
      }
      next(err);
    }
  });

  r.post("/projects/:projectId/services/:serviceId/enable", async (req, res, next) => {
    try {
      if (!(await requireUser(req))) return res.redirect("/login");
      const { projectId, serviceId } = req.params;
      await api(req).post(
        `/api/v1/projects/${projectId}/services/${serviceId}/enable`,
        {},
      );
      res.redirect(`/projects/${projectId}/services/${serviceId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        res.redirect(
          `/projects/${req.params.projectId}/services/${req.params.serviceId}?error=${encodeURIComponent(err.message)}`,
        );
        return;
      }
      next(err);
    }
  });

  r.post("/projects/:projectId/services/:serviceId/disable", async (req, res, next) => {
    try {
      if (!(await requireUser(req))) return res.redirect("/login");
      const { projectId, serviceId } = req.params;
      await api(req).post(
        `/api/v1/projects/${projectId}/services/${serviceId}/disable`,
        {},
      );
      res.redirect(`/projects/${projectId}/services/${serviceId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        res.redirect(
          `/projects/${req.params.projectId}/services/${req.params.serviceId}?error=${encodeURIComponent(err.message)}`,
        );
        return;
      }
      next(err);
    }
  });

  r.post("/projects/:projectId/services/:serviceId/override", async (req, res, next) => {
    try {
      if (!(await requireUser(req))) return res.redirect("/login");
      const { projectId, serviceId } = req.params;
      const b = body(req);
      await api(req).post(
        `/api/v1/projects/${projectId}/services/${serviceId}/override`,
        {
          status: b.status,
          reason: b.reason,
          expiresAt: b.expiresAt,
        },
      );
      res.redirect(`/projects/${projectId}/services/${serviceId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        res.redirect(
          `/projects/${req.params.projectId}/services/${req.params.serviceId}?error=${encodeURIComponent(err.message)}`,
        );
        return;
      }
      next(err);
    }
  });

  r.post("/projects/:projectId/services/:serviceId/override/cancel", async (req, res, next) => {
    try {
      if (!(await requireUser(req))) return res.redirect("/login");
      const { projectId, serviceId } = req.params;
      await createApiClient(config, readToken(req, config)).del(
        `/api/v1/projects/${projectId}/services/${serviceId}/override`,
      );
      res.redirect(`/projects/${projectId}/services/${serviceId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        res.redirect(
          `/projects/${req.params.projectId}/services/${req.params.serviceId}?error=${encodeURIComponent(err.message)}`,
        );
        return;
      }
      next(err);
    }
  });

  // —— Incidents ——
  r.get("/projects/:projectId/incidents", async (req, res, next) => {
    try {
      const user = await requireUser(req);
      if (!user) return res.redirect("/login");
      const id = req.params.projectId!;
      const data = await api(req).get<{ incidents?: unknown[] }>(
        `/api/v1/projects/${id}/incidents?limit=50`,
      );
      await renderPage(res, "app/incidents", {
        title: "Incidents",
        user: { email: user.email },
        projectId: id,
        incidents: data.incidents ?? [],
        brandHref: "/projects",
        nav: nav("projects", Boolean(user.isAdmin)),
        sideTitle: "Project",
        sideNav: projectSide(id, "incidents"),
      });
    } catch (err) {
      next(err);
    }
  });

  r.get("/projects/:projectId/incidents/:incidentId", async (req, res, next) => {
    try {
      const user = await requireUser(req);
      if (!user) return res.redirect("/login");
      const { projectId, incidentId } = req.params;
      const data = await api(req).get<{
        incident: Record<string, unknown>;
        updates?: unknown[];
      }>(`/api/v1/projects/${projectId}/incidents/${incidentId}`);
      await renderPage(res, "app/incident", {
        title: String(data.incident?.title ?? "Incident"),
        user: { email: user.email },
        projectId,
        incident: data.incident,
        updates: data.updates ?? (data.incident as { updates?: unknown[] })?.updates ?? [],
        error: flash(req),
        brandHref: "/projects",
        nav: nav("projects", Boolean(user.isAdmin)),
      });
    } catch (err) {
      next(err);
    }
  });

  r.post("/projects/:projectId/incidents/:incidentId/updates", async (req, res, next) => {
    try {
      if (!(await requireUser(req))) return res.redirect("/login");
      const { projectId, incidentId } = req.params;
      const b = body(req);
      const payload: Record<string, unknown> = {
        message: b.message,
        isPublic: b.isPublic === "true" || b.isPublic === "on",
      };
      if (b.status) payload.status = b.status;
      await api(req).post(
        `/api/v1/projects/${projectId}/incidents/${incidentId}/updates`,
        payload,
      );
      res.redirect(`/projects/${projectId}/incidents/${incidentId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        res.redirect(
          `/projects/${req.params.projectId}/incidents/${req.params.incidentId}?error=${encodeURIComponent(err.message)}`,
        );
        return;
      }
      next(err);
    }
  });

  // —— Members ——
  r.get("/projects/:projectId/members", async (req, res, next) => {
    try {
      const user = await requireUser(req);
      if (!user) return res.redirect("/login");
      const id = req.params.projectId!;
      const data = await api(req).get<{
        members: Array<{
          userId: string;
          email: string;
          name: string | null;
          role: string;
        }>;
      }>(`/api/v1/projects/${id}/members`);
      await renderPage(res, "app/members", {
        title: "Members",
        user: { email: user.email },
        projectId: id,
        members: data.members ?? [],
        error: flash(req),
        brandHref: "/projects",
        nav: nav("projects", Boolean(user.isAdmin)),
        sideTitle: "Project",
        sideNav: projectSide(id, "members"),
      });
    } catch (err) {
      next(err);
    }
  });

  r.post("/projects/:projectId/members", async (req, res, next) => {
    try {
      if (!(await requireUser(req))) return res.redirect("/login");
      const id = req.params.projectId!;
      const b = body(req);
      await api(req).post(`/api/v1/projects/${id}/members`, {
        email: b.email,
        role: b.role || "Viewer",
      });
      res.redirect(`/projects/${id}/members`);
    } catch (err) {
      if (err instanceof ApiError) {
        res.redirect(
          `/projects/${req.params.projectId}/members?error=${encodeURIComponent(err.message)}`,
        );
        return;
      }
      next(err);
    }
  });

  r.post("/projects/:projectId/members/:userId/role", async (req, res, next) => {
    try {
      if (!(await requireUser(req))) return res.redirect("/login");
      const { projectId, userId } = req.params;
      await api(req).patch(`/api/v1/projects/${projectId}/members/${userId}`, {
        role: body(req).role,
      });
      res.redirect(`/projects/${projectId}/members`);
    } catch (err) {
      if (err instanceof ApiError) {
        res.redirect(
          `/projects/${req.params.projectId}/members?error=${encodeURIComponent(err.message)}`,
        );
        return;
      }
      next(err);
    }
  });

  // —— Plan / alerts (existing) ——
  r.get("/projects/:projectId/plan", async (req, res, next) => {
    try {
      const user = await requireUser(req);
      if (!user) return res.redirect("/login");
      const id = req.params.projectId!;
      const data = await api(req).get<{
        plan?: { name: string };
        planName?: string;
        usage?: { services: number; members: number };
        limits?: { services: number; members: number };
      }>(`/api/v1/projects/${id}/plan`);
      await renderPage(res, "app/plan", {
        title: "Plan",
        user: { email: user.email },
        projectId: id,
        planName: data.plan?.name ?? data.planName ?? "free",
        usage: data.usage ?? { services: 0, members: 0 },
        limits: data.limits ?? { services: 3, members: 3 },
        message: req.query.ok ? "Plan updated." : null,
        error: typeof req.query.error === "string" ? req.query.error : null,
        brandHref: "/projects",
        nav: nav("projects", Boolean(user.isAdmin)),
        sideTitle: "Project",
        sideNav: projectSide(id, "plan"),
      });
    } catch (err) {
      next(err);
    }
  });

  r.post("/projects/:projectId/plan", async (req, res, next) => {
    try {
      if (!(await requireUser(req))) return res.redirect("/login");
      const id = req.params.projectId!;
      const key = randomBytes(8).toString("hex");
      await api(req).post(
        `/api/v1/projects/${id}/plan`,
        { planName: body(req).planName || "pro" },
        { "Idempotency-Key": key },
      );
      res.redirect(`/projects/${id}/plan?ok=1`);
    } catch (err) {
      if (err instanceof ApiError) {
        res.redirect(
          `/projects/${req.params.projectId}/plan?error=${encodeURIComponent(err.message)}`,
        );
        return;
      }
      next(err);
    }
  });

  r.get("/projects/:projectId/alerts", async (req, res, next) => {
    try {
      const user = await requireUser(req);
      if (!user) return res.redirect("/login");
      const id = req.params.projectId!;
      const data = await api(req).get<{ alerts?: unknown[] }>(
        `/api/v1/projects/${id}/alerts`,
      );
      await renderPage(res, "app/alerts", {
        title: "Alerts",
        user: { email: user.email },
        projectId: id,
        alerts: data.alerts ?? [],
        brandHref: "/projects",
        nav: nav("projects", Boolean(user.isAdmin)),
        sideTitle: "Project",
        sideNav: projectSide(id, "alerts"),
      });
    } catch (err) {
      next(err);
    }
  });

  r.post(
    "/projects/:projectId/alerts/:alertId/acknowledge",
    async (req, res, next) => {
      try {
        if (!(await requireUser(req))) return res.redirect("/login");
        const { projectId, alertId } = req.params;
        await api(req).post(
          `/api/v1/projects/${projectId}/alerts/${alertId}/acknowledge`,
          {},
        );
        res.redirect(`/projects/${projectId}/alerts`);
      } catch (err) {
        next(err);
      }
    },
  );

  // —— Public ——
  r.get("/status/:slug", async (req, res, next) => {
    try {
      const slug = req.params.slug!;
      const data = await createApiClient(config, null).get<{
        project: { name: string; slug: string };
        services: Array<{
          name: string;
          currentStatus?: string;
          status?: string;
          activeIncident?: { title: string; status: string } | null;
          recentHistory?: Array<{ status: string; startedAt: string }>;
        }>;
      }>(`/api/v1/public/${slug}`);
      const services = (data.services ?? []).map((s) => ({
        ...s,
        status: s.currentStatus ?? s.status ?? "Unknown",
      }));
      const overall =
        services.some((s) => s.status === "Outage")
          ? "Outage"
          : services.some((s) => s.status === "Degraded")
            ? "Degraded"
            : services.length
              ? "Operational"
              : "Unknown";
      await renderPage(res, "public/status", {
        title: data.project.name,
        project: data.project,
        services,
        overall,
        brandHref: `/status/${slug}`,
        nav: [],
      });
    } catch (err) {
      next(err);
    }
  });

  r.get("/status/:slug/subscribe", async (req, res) => {
    await renderPage(res, "public/subscribe", {
      title: "Subscribe",
      slug: req.params.slug,
      error: null,
      message: null,
      brandHref: `/status/${req.params.slug}`,
      nav: [],
    });
  });

  r.post("/status/:slug/subscribe", async (req, res, next) => {
    try {
      const slug = req.params.slug!;
      await createApiClient(config, null).post(`/api/v1/public/${slug}/subscribe`, {
        email: body(req).email,
      });
      await renderPage(res, "public/subscribe", {
        title: "Subscribe",
        slug,
        error: null,
        message: "Check your email to verify the subscription.",
        brandHref: `/status/${slug}`,
        nav: [],
      });
    } catch (err) {
      if (err instanceof ApiError) {
        await renderPage(res, "public/subscribe", {
          title: "Subscribe",
          slug: req.params.slug,
          error: err.message,
          message: null,
          brandHref: `/status/${req.params.slug}`,
          nav: [],
        });
        return;
      }
      next(err);
    }
  });

  // —— Admin ——
  r.get("/admin", async (req, res, next) => {
    try {
      const user = await requireAdmin(req, res);
      if (!user) return;
      await renderPage(res, "app/admin", {
        title: "Administration",
        user: { email: user.email },
        brandHref: "/projects",
        nav: nav("admin", true),
      });
    } catch (err) {
      next(err);
    }
  });

  async function adminTable(
    req: Request,
    res: Response,
    title: string,
    path: string,
    renderRows: (data: unknown) => string,
  ) {
    const user = await requireAdmin(req, res);
    if (!user) return;
    try {
      const data = await api(req).get(path);
      await renderPage(res, "app/admin-table", {
        title,
        user: { email: user.email },
        tableHtml: renderRows(data),
        error: null,
        brandHref: "/projects",
        nav: nav("admin", true),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        await renderPage(res, "app/admin-table", {
          title,
          user: { email: user.email },
          error: err.message,
          tableHtml: "",
          brandHref: "/projects",
          nav: nav("admin", true),
        });
        return;
      }
      throw err;
    }
  }

  r.get("/admin/failures", (req, res, next) => {
    void adminTable(
      req,
      res,
      "Scheduler failures",
      "/api/v1/admin/scheduler-failures?limit=100",
      (data) => {
        const rows =
          (data as { failures?: Array<{ createdAt: string; message: string }> })
            .failures ?? [];
        if (!rows.length) return `<div class="empty">None</div>`;
        return `<table class="data card"><thead><tr><th>When</th><th>Message</th></tr></thead><tbody>${rows
          .map(
            (f) =>
              `<tr><td class="muted">${new Date(f.createdAt).toLocaleString()}</td><td><code>${escapeHtml(f.message)}</code></td></tr>`,
          )
          .join("")}</tbody></table>`;
      },
    ).catch(next);
  });

  r.get("/admin/jobs", (req, res, next) => {
    void adminTable(
      req,
      res,
      "Check jobs",
      "/api/v1/admin/jobs?minAttempts=1&limit=100",
      (data) => {
        const rows =
          (
            data as {
              jobs?: Array<{
                serviceName: string;
                status: string;
                attempts: number;
                scheduledFor: string;
              }>;
            }
          ).jobs ?? [];
        if (!rows.length) return `<div class="empty">None</div>`;
        return `<table class="data card"><thead><tr><th>Service</th><th>Status</th><th>Attempts</th><th>Scheduled</th></tr></thead><tbody>${rows
          .map(
            (j) =>
              `<tr><td>${escapeHtml(j.serviceName)}</td><td>${escapeHtml(j.status)}</td><td>${j.attempts}</td><td class="muted">${new Date(j.scheduledFor).toLocaleString()}</td></tr>`,
          )
          .join("")}</tbody></table>`;
      },
    ).catch(next);
  });

  r.get("/admin/outbox", (req, res, next) => {
    void adminTable(
      req,
      res,
      "Outbox",
      "/api/v1/admin/outbox?limit=100",
      (data) => {
        const rows =
          (
            data as {
              messages?: Array<{
                recipientEmail: string;
                subject: string;
                attempts: number;
                lastError: string | null;
              }>;
            }
          ).messages ?? [];
        if (!rows.length) return `<div class="empty">Clear</div>`;
        return `<table class="data card"><thead><tr><th>To</th><th>Subject</th><th>Attempts</th><th>Error</th></tr></thead><tbody>${rows
          .map(
            (m) =>
              `<tr><td>${escapeHtml(m.recipientEmail)}</td><td>${escapeHtml(m.subject)}</td><td>${m.attempts}</td><td class="muted">${escapeHtml(m.lastError ?? "—")}</td></tr>`,
          )
          .join("")}</tbody></table>`;
      },
    ).catch(next);
  });

  r.get("/admin/audit", (req, res, next) => {
    void adminTable(
      req,
      res,
      "Audit log",
      "/api/v1/admin/audit?limit=100",
      (data) => {
        const rows =
          (
            data as {
              entries?: Array<{
                createdAt: string;
                actorEmail: string | null;
                action: string;
                entityType: string;
              }>;
            }
          ).entries ?? [];
        if (!rows.length) return `<div class="empty">None</div>`;
        return `<table class="data card"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead><tbody>${rows
          .map(
            (e) =>
              `<tr><td class="muted">${new Date(e.createdAt).toLocaleString()}</td><td>${escapeHtml(e.actorEmail ?? "—")}</td><td><code>${escapeHtml(e.action)}</code></td><td class="muted">${escapeHtml(e.entityType)}</td></tr>`,
          )
          .join("")}</tbody></table>`;
      },
    ).catch(next);
  });

  r.get("/admin/users", (req, res, next) => {
    void adminTable(
      req,
      res,
      "Users",
      "/api/v1/admin/users?limit=100",
      (data) => {
        const rows =
          (
            data as {
              users?: Array<{
                id: string;
                email: string;
                name: string | null;
                isAdmin: boolean;
                createdAt: string;
              }>;
            }
          ).users ?? [];
        const me = readEmail(req, config);
        return `<table class="data card"><thead><tr><th>Email</th><th>Name</th><th>Admin</th><th>Joined</th><th></th></tr></thead><tbody>${rows
          .map((u) => {
            const self = u.email === me;
            let action = "—";
            if (!self) {
              action = u.isAdmin
                ? `<form method="post" action="/admin/users/${u.id}/admin" style="display:inline"><input type="hidden" name="action" value="revoke"/><button class="btn secondary" type="submit">Revoke</button></form>`
                : `<form method="post" action="/admin/users/${u.id}/admin" style="display:inline"><input type="hidden" name="action" value="grant"/><button class="btn" type="submit">Make admin</button></form>`;
            }
            return `<tr><td>${escapeHtml(u.email)}${self ? ' <span class="muted">(you)</span>' : ""}</td><td class="muted">${escapeHtml(u.name ?? "—")}</td><td>${u.isAdmin ? "yes" : "—"}</td><td class="muted">${new Date(u.createdAt).toLocaleDateString()}</td><td>${action}</td></tr>`;
          })
          .join("")}</tbody></table>`;
      },
    ).catch(next);
  });

  r.post("/admin/users/:userId/admin", async (req, res, next) => {
    try {
      const user = await requireAdmin(req, res);
      if (!user) return;
      await api(req).post(`/api/v1/admin/users/${req.params.userId}/admin`, {
        action: body(req).action,
      });
      res.redirect("/admin/users");
    } catch (err) {
      if (err instanceof ApiError) {
        res.status(err.status).type("html").send(escapeHtml(err.message));
        return;
      }
      next(err);
    }
  });

  r.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    const msg = err instanceof Error ? err.message : "Error";
    res.status(500).type("html").send(`<!doctype html><p>${escapeHtml(msg)}</p>`);
  });

  return r;
}
