# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Email **miguel.rf267@gmail.com** with:

- what you found and where (URL, file, endpoint)
- steps to reproduce or a proof of concept
- the impact as you understand it

You'll get an acknowledgement within 72 hours and a fix or a plan within 14 days for confirmed issues. Credit is given in the release notes unless you'd rather stay anonymous.

## Supported versions

The `main` branch and the latest tagged release.

## What's in place

- All data access is scoped by `user_id` on the server; clients never receive another user's rows.
- Every server action and route handler validates input with Zod.
- Sessions: better-auth, `HttpOnly` cookies (`Secure` in production), 30-day expiry, revoked on password reset.
- Rate limiting on sign-in, sign-up and password-reset endpoints.
- Uploads (covers) are size- and type-restricted and stored in the database, never on a public path.
- Response headers: `nosniff`, `X-Frame-Options: DENY`, restrictive `Referrer-Policy` and `Permissions-Policy`.
- Secrets live only in environment variables; nothing sensitive is bundled to the client (`lib/env.ts` is server-only).
- Passwords, tokens and setting contents are never logged.

See [docs/architecture/overview.md](docs/architecture/overview.md#security) for details.
