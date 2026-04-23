# SmartPolicy Portal

Professional full-stack rebuild of the original single-file prototype into a maintainable project structure.

## Requirements

- **Node.js 22.5+** (uses the built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) module; may log an experimental-feature warning on startup).

## Project structure

- `backend/` Node HTTP server, API routes, persistence, auth, and audit logic
- `frontend/` modular browser SPA with separate views, layout, and shared utilities
- `prisma/` optional PostgreSQL schema scaffold (not used at runtime; SQLite is the live store for this build)
- `legacy/` preserved original source files from the prototype

## Run locally

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Import this GitHub repo in Vercel.
2. Set **Root Directory** to `projekti` (required). The app is not at the repository root, so the default root will 404.
3. **Framework preset**: Other. Leave **Build Command** empty. In **Project Settings → General** (or the import wizard), set **Output Directory** to `frontend` so Vercel publishes the static files from `projekti/frontend` (not the repo root).
4. **Install command**: `npm install` (default is fine with Root = `projekti`).
5. **Node version**: use **22.x** (see `package.json` `engines`) so the built-in `node:sqlite` module is available to API routes.
6. **Environment variables** (recommended in production): set `TOKEN_SECRET` to a long random string, and `DEMO_MODE=0` if you do not want unauthenticated demo login.

**Note:** The SQLite database is stored in serverless **temporary** storage on Vercel (see `VERCEL` in `backend/src/config.js`). Data is not durable across all deployments; for a real production app, use a hosted database. The API is exposed via [`api/[[...slug]].js`](api/[[...slug]].js); the `npm start` server in `backend/server.js` is for local use only.

### Data storage

All application data is stored in a **local SQLite** file at:

`backend/data/smartpolicy.db`

On first start, the database file is created and **seeded** with the demo users and sample policies. You can open this file with [DB Browser for SQLite](https://sqlitebrowser.org/), the SQLite CLI, or any SQLite viewer. User passwords for the demo are stored in **plaintext** in the `users.password` column for show-and-tell; do not use this for production.

The previous JSON store (`store.json`) is no longer read by the server. You can delete it if you no longer need a reference copy.

## Environment variables

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `3000`) |
| `TOKEN_SECRET` | Secret for HMAC session tokens (set this if the app is exposed beyond localhost) |
| `TOKEN_TTL_SECONDS` | Token lifetime in seconds |
| `APP_NAME` | Custom application name in logs |
| `DEMO_MODE` | `0` disables one-click **demo login**; any other value (default) keeps it enabled for local demos |

## Demo credentials

| Role    | Email               | Password    |
|---------|---------------------|------------|
| Admin   | `admin@school.edu`  | `admin123` |
| Manager | `manager@school.edu`| `manager123` |
| Staff   | `staff@school.edu`  | `staff123` |
| Student | `student@school.edu`| `student123` |
| Auditor | `auditor@school.edu`| `auditor123` |

You can also use the demo login buttons on the sign-in screen (when `DEMO_MODE` is not `0`).

## Feature summary

- Authentication with registration and demo sign-in
- Role-based access for admin, manager, staff, student, and auditor
- Policy creation, editing, manager approval, publication, and viewing
- Policy acknowledgements with timestamp, IP address, and audit record
- Dashboard summaries tailored by role
- Pending signature tracking for staff and students
- User role and active/inactive status management for administrators
- Searchable and paginated audit log register with CSV export

See `docs/security-note.md` for limitations of this show build.
