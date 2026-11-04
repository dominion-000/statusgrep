# StatusGrep (Astro + Tailwind)

Full SSR UI for Status Pulse. **Parallel** to the existing EJS app — test before replacing.

## Run

```bash
cp .env.example .env   # API_BASE_URL=https://your-status-pulse
pnpm install
pnpm dev               # http://localhost:4321
```

## Production

```bash
pnpm build
API_BASE_URL=... node dist/server/entry.mjs
```

On the API set `CORS_ORIGIN` to this UI URL address.

## Covered routes

| Area      | Paths                                                                              |
| --------- | ---------------------------------------------------------------------------------- |
| Auth      | `/` `/login` `/register` `/logout` `/forgot-password` `/reset-password` `/account` |
| Projects  | `/projects` `/projects/:id` (services create, delete project)                      |
| Services  | detail, edit, enable/disable, delete, override                                     |
| Incidents | list, detail, updates (next status only)                                           |
| Alerts    | list + acknowledge                                                                 |
| Members   | list, invite, role                                                                 |
| Plan      | list + Paystack upgrade + callback                                                 |
| Public    | `/status/:slug` subscribe                                                          |
| Admin     | hub, failures, jobs, outbox, audit, users                                          |
