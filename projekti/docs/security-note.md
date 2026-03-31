# Security Note

## Implemented Measures

- Passwords are stored with `scrypt` hashing and verified with timing-safe comparison.
- Tokens are HMAC-signed and now read their secret and lifetime from environment variables when provided.
- Request payloads are validated for login, registration, role changes, and policy updates.
- Policy HTML is sanitized before storage to remove scripts, inline event handlers, `javascript:` URLs, and embedded active content.
- Acknowledgements now store the exact policy version signed, basic evidence metadata, and a linked audit log id.
- Audit log filters now support policy, user, role, action, entity, and date filtering for clearer reporting.

## Project-Appropriate Limitations

- The application still uses a local JSON store rather than a transactional database.
- The HTML sanitization is intentionally lightweight and suitable for a school project, not a full production-grade sanitizer.
- Tokens are custom signed strings rather than a full session management platform with refresh tokens and revocation lists.
- No rate limiting, CSRF protection, secure cookie strategy, or centralized secrets manager is implemented.

## Production Improvements

- Move fully to PostgreSQL with Prisma migrations and relational constraints enforced in production.
- Replace lightweight HTML sanitization with a dedicated, battle-tested sanitizer.
- Add rate limiting, account lockout protection, refresh-token rotation, and secret rotation support.
- Add structured audit retention rules, immutable evidence storage, and stronger reporting exports.
