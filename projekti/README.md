# SmartPolicy Portal

Professional full-stack rebuild of the original single-file prototype into a maintainable project structure.

## Project structure

- `backend/` Node HTTP server, API routes, persistence, auth, and audit logic
- `frontend/` modular browser SPA with separate views, layout, and shared utilities
- `prisma/` PostgreSQL schema and migration scaffold aligned to the Word document
- `legacy/` preserved original source files from the prototype

## Run locally

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Optional environment variables:

- `TOKEN_SECRET` custom token signing secret
- `TOKEN_TTL_SECONDS` token lifetime in seconds
- `APP_NAME` custom application name

## Demo credentials

- Admin: `admin@school.edu` / `admin123`
- Manager: `manager@school.edu` / `manager123`
- Staff: `staff@school.edu` / `staff123`
- Student: `student@school.edu` / `student123`
- Auditor: `auditor@school.edu` / `auditor123`

You can also use the demo login buttons on the sign-in screen.

## Implemented requirements from the provided codebase

- Authentication with registration and demo sign-in
- Role-based access for admin, staff, student, and auditor
- Role-based access for admin, manager, staff, student, and auditor
- Policy creation, editing, manager approval, publication, and viewing
- Policy acknowledgements with timestamp, IP address, and audit record
- Dashboard summaries tailored by role
- Pending signature tracking for staff and students
- User role management for administrators
- Searchable and paginated audit log register with CSV export
- Persistent data storage in `backend/data/store.json`
- Prisma/PostgreSQL schema scaffold for future Supabase or Render deployment

## Note

The live app currently runs on the local JSON store for zero-setup use. The Prisma/PostgreSQL scaffold was added to align the codebase with the Word document, but dependency installation and production database provisioning were not performed in this sandboxed session.

See `docs/security-note.md` for the current security measures, known limitations, and production follow-up recommendations.
