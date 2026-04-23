# Security Note (demo / show build)

## Implemented measures

- Session tokens are HMAC-SHA256 signed; use `TOKEN_SECRET` and `TOKEN_TTL_SECONDS` in the environment.
- Request payloads are validated for login, registration, role and active state changes, and policy updates.
- Policy HTML is sanitized before storage to reduce scripts, inline handlers, and dangerous URLs.
- Acknowledgements store the policy version, basic evidence metadata, and a link to the audit log entry where applicable.
- Demo login is gated by `DEMO_MODE=0` (set this to disable `/api/auth/demo-login` in shared environments).
- The server logs a warning when the default `TOKEN_SECRET` is used.

## Show-build limitations (not production safe)

- **Passwords in SQLite** are stored as **plaintext** in `users.password` so a jury or reviewer can open `backend/data/smartpolicy.db` and see credentials. This is intentional for the classroom/showcase only.
- The Node.js built-in **SQLite** integration (`node:sqlite`) is still flagged **experimental**; behavior may change in future Node versions.
- The UI stores the bearer token in `localStorage` (XSS can steal it); there is no CSRF or cookie-based hardening.
- There is no rate limiting, account lockout, or centralized secrets management.
- The optional **Prisma/PostgreSQL** files under `prisma/` are not the runtime data layer in this build.

## If you take this to production

- Enforce **hashed** passwords (e.g. scrypt/argon2), never plaintext, and add password policies.
- Move to a managed or self-hosted RDBMS with proper backups, RLS, and least-privilege app accounts.
- Use a hardened session strategy (httpOnly cookies, CSRF, refresh rotation) and a battle-tested sanitizer.
- Add rate limits, security headers, and abuse monitoring; disable demo login and open registration on public instances.
