# MIRAI backend API

NestJS API using Prisma 7 and PostgreSQL for accounts, staff access, plots, reservations, documents, co-ownership, buyers, announcements and activity. See the [root README](../README.md) for feature status and full setup. The tables below focus on authentication.

## Start

From the repository root:

```sh
npm ci
npm run db:generate --workspace @mirai/backend
npm run db:migrate
npm run dev:api
```

Requires Node.js 22.12+ or 24+, PostgreSQL, and SMTP credentials. Copy `.env.example` to `.env` for a fresh installation. The supplied Neon and Gmail configuration is saved only in the ignored local `.env`. Never put these credentials in frontend environment variables.

`DATABASE_URL` is the single connection used by the running API, Prisma migrations, and database tests. For Neon, use the supplied pooled connection URL.

Development API: `http://localhost:4000/api/v1`. Health check: `GET /api/v1/health`.

`start:dev` compiles TypeScript and uses Node's native watcher to reload the API when emitted files change. `npm start` runs compiled files without watching; rebuild and restart it after source changes.

Production: build with `npm run build --workspace @mirai/backend`, apply `npm run db:migrate`, then `npm run start --workspace @mirai/backend`. Set `NODE_ENV=production`, public HTTPS `API_URL`, exact `FRONTEND_URL`, and a unique random `JWT_SECRET`. `API_URL` must be reachable by email recipients. Localhost links work only on the machine running the API.

## Endpoints

| Method | Path, relative to `/api/v1`    | Input / behavior                                                                                                     |
| ------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| POST   | `/auth/signup`                 | `{ "name": "Your Name", "email": "you@example.com", "password": "A-long-password-123" }`; 202 and verification email |
| POST   | `/auth/resend-verification`    | `{ "email": "you@example.com" }`; 202, 60-second cooldown                                                            |
| GET    | `/auth/verify-email?token=...` | Branded confirmation page; does not consume the token                                                                |
| POST   | `/auth/verify-email/confirm`   | HTML form confirmation used by email recipients                                                                      |
| POST   | `/auth/verify-email`           | `{ "token": "..." }`; JSON verification alternative                                                                  |
| POST   | `/auth/login`                  | `{ "email": "you@example.com", "password": "..." }`; verified accounts only                                          |
| POST   | `/auth/refresh`                | Refresh cookie and trusted `Origin`; rotates the session                                                             |
| GET    | `/auth/me`                     | `Authorization: Bearer <accessToken>`                                                                                |
| POST   | `/auth/logout`                 | Bearer token; revokes the session and clears refresh cookie                                                          |

Passwords require 8 to 128 characters, including an uppercase letter, a lowercase letter, a number, and a special character. Password confirmation is checked in the frontend and is not sent to the API. Names require 2 to 100 characters. Emails are trimmed and lowercased. Unknown fields, including role assignment, are rejected. Duplicate sign-up never overwrites account credentials.

Sign-up and resend return the same message for existing and unknown addresses. SMTP failures return 503 and leave the account unverified; resend can be attempted immediately. Verification codes are six random digits, single use, and expire after 10 minutes. Only a keyed HMAC bound to the user and token nonce is stored. Five incorrect attempts lock code verification until resend. Resending replaces the previous code and link. Existing verification-link endpoints remain supported as a fallback.

Login and refresh return `accessToken`, `tokenType: "Bearer"`, `expiresIn: 900`, and `user` containing `id`, `email`, `name`, `emailVerifiedAt`, `createdAt`, `staffRole` and `staffActive`. Password hashes and refresh tokens never appear in JSON responses.

Refresh tokens use an HttpOnly cookie, are hashed in the database, and expire no later than 30 days after login. Access tokens last 15 minutes. Refresh rotates both tokens and invalidates the previous access token. Reuse of an old refresh token revokes the session family. Clients must serialize refresh requests and replace their access token after each refresh. Logout revokes the current session; other devices remain signed in.

Browser clients should use `credentials: 'include'` for login, refresh, and logout, keep access tokens in memory, and send bearer tokens on protected requests. Refresh requires `Origin` matching `FRONTEND_URL` or `API_URL`; command-line clients must set it explicitly. Cookie policy is HttpOnly, SameSite=Lax, Secure in production. Deploy frontend and API on the same site, such as `www.example.com` and `api.example.com`, for this policy.

`POST /api/v1/auth/verify-code` accepts `{ "email": "you@example.com", "code": "012345" }`. Keep the code as a string so leading zeros are preserved. Success verifies the address; the customer then signs in.

## Emails

Responsive HTML and plain text templates use MIRAI gold `#DF9F53`, navy `#00101A`, and white. User content is escaped; templates have no remote images or tracking pixels. The code is shown prominently in both versions. A fallback link opens a confirmation page, so email scanners do not activate accounts automatically.

`npm run smtp:verify --workspace @mirai/backend` checks connection and authentication without sending mail. Tests replace the mail service and never send real email.

## Tests

```sh
npm run test --workspace @mirai/backend
npm run test:e2e --workspace @mirai/backend
npm run typecheck --workspace @mirai/backend
```

Default tests build the server and check email rendering. `test:e2e` also sends real HTTP requests and executes PostgreSQL transactions inside an automatically generated `mirai_test_<random>` schema. It creates synthetic accounts only there, sends no real email, and drops the schema in `finally`. The database role needs schema creation rights. Existing application tables are never reset or truncated.

Tests cover validation, hashing, normalization, duplicate registration, verification expiry and replay, SMTP recovery, login, response redaction, cookies, refresh rotation and replay, logout, origin checks, and rate limiting.

## Operations

16 KB request limit, Helmet, strict validation, no-store responses, trusted browser origins, and endpoint rate limits are enabled. Passwords use Argon2id with 64 MiB memory and three iterations. Never log passwords, tokens, SMTP credentials, or connection URLs.

Rate limits use per-process memory. Use a shared throttler store before running multiple instances. Forwarded IP headers are not trusted by default; configure trust only for a known reverse proxy during deployment. Schedule retention cleanup for expired verification records and sessions as traffic grows. Password reset and social login are outside this auth scope.

## Admin authentication and owner setup

Build the backend and apply migrations before setting up the first owner:

```sh
npm run build --workspace @mirai/backend
npm run db:migrate
npm run admin:bootstrap --workspace @mirai/backend -- --email owner@example.com
```

The command sends an email with a single-use, 24-hour password setup link. It creates no default password and grants no access until the recipient sets their password. It refuses a new owner bootstrap after a staff account exists. Rerun for the same pending owner email to replace an expired link (one-minute cooldown). No public owner setup endpoint exists.

The invitation token is random, stored only as a SHA-256 hash, and placed in the email URL fragment so it is not sent in the page request. Inspecting a link does not accept it. Password submission atomically consumes the token, verifies email ownership, hashes the chosen password and grants the assigned role. Existing buyer accounts retain their ID and data; setting a password revokes their previous sessions.

| Method | Path relative to `/api/v1` | Behavior |
| --- | --- | --- |
| POST | `/auth/admin/login` | Email/password; verified, active staff only. Returns normal session credentials. |
| POST | `/auth/admin/invitation` | `{token}`; inspect an unexpired invitation without consuming it. |
| POST | `/auth/admin/accept-invitation` | `{token,password}`; set password and activate access. Sign in afterwards. |
| GET | `/admin/auth/me` | Bearer token; returns fresh database staff identity and allowed sections. |
| GET | `/admin/auth/staff` | Active Super Admin only; real staff and pending invitations, no tokens or password hashes. |
| POST | `/admin/auth/invitations` | Active Super Admin only; `{name,email,role}`; sends a password setup email. Resending replaces the old link. |
| POST | `/admin/auth/staff/:id/access` | Active Super Admin only; `{active:boolean}`; suspend or restore another staff member. Suspension revokes sessions. |

Roles: `SUPER_ADMIN`, `LISTING_MANAGER`, `VERIFICATION_REVIEWER`, `PAYMENT_SUPPORT`, `DOCUMENT_ADMINISTRATOR`, `SITE_CHECK_CONTRIBUTOR`. Public signup rejects staff role fields. Staff membership is read from the database on every protected request. Invitations cannot activate if their issuer is no longer an active Super Admin. You cannot suspend your own access or leave the platform without an active owner. Re-enabling access requires a fresh sign-in.

Both apps share the existing HttpOnly refresh-cookie session mechanism. The admin frontend checks `/admin/auth/me` before rendering the workspace and on navigation, focus and every minute. This UI check supplements permission enforcement in the backend services. Connected property operations and activity history enforce backend permissions. Some site-check and legacy frontend views remain previews.

Auth integration tests run in disposable `mirai_test_<random>` schemas and mock all mail delivery. They cover owner activation, invitation expiry/replay/resend, buyer and non-owner denial, staff suspension, existing-buyer activation and secret redaction.


## Flexible staff access

The invitation UI asks only for name and email. Omitting role in the invitation API assigns `ADMIN` automatically, with all operational sections and no staff management authority. Optional role/permission fields remain supported for existing invitation resends and advanced API clients. Super Admins can edit existing staff access separately. The selected sections are stored on `StaffInvitation.permissions` and copied to `User.staffPermissions` when the invitation is accepted. An empty stored array preserves the role's original preset for older records; explicit Overview-only access is `["dashboard"]`. Overview is always included.

`POST /admin/auth/staff/:id/permissions` accepts `{role, permissions?: string[]}` and lets an active Super Admin update another staff member. The invitation endpoint accepts the same optional `permissions` array alongside name/email/role. Keys are validated against the supported operational sections; unknown keys, duplicates and `staff` are rejected. Staff administration is available only through the explicit `SUPER_ADMIN` role, which always has full access. Selecting all operational sections does not grant staff administration. Self-demotion and removal of the final active Super Admin are blocked.

`GET /admin/auth/me` resolves effective permissions from the current database record, so existing tokens see permission changes immediately on their next request. The frontend uses that response for navigation and route access. Staff accounts can be edited from **Staff & access → Edit permissions**. Resending an invitation keeps its chosen sections. Existing accounts and invitations keep their previous access after the additive migration.

