# StatusGrep (full operator UI)

EJS UI for Status Pulse API.

## Screens

- Auth, projects, project overview (status pills)
- Service detail: results, history, enable/disable, override
- Service edit
- Incidents list + detail + timeline updates
- Members invite + role change
- Plan, alerts
- Public status (overall banner) + subscribe
- Admin tables + grant/revoke admin

## Run

```bash
cp .env.example .env
# API_BASE_URL=http://127.0.0.1:3000
pnpm install && pnpm build && pnpm start
```

API must allow `CORS_ORIGIN=http://localhost:4000`.
