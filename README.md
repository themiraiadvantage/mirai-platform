# MIRAI Platform

MIRAI brings land discovery, reservations, documents and co-ownership into one workspace for buyers and the team managing the platform.

This monorepo contains the public website, buyer dashboard, admin portal, backend API and database migrations.

## Technology

- **Frontend:** Next.js App Router, React, TypeScript, Tailwind CSS, Radix UI and Leaflet.
- **Backend:** NestJS, Prisma and PostgreSQL.
- **Services:** Cloudinary for plot photos, SMTP for account emails and Paystack for reservation checkout.
- **Testing:** Vitest, Testing Library and Node.js integration tests.

## Current features

| Area | Connected functionality |
| --- | --- |
| Accounts | Signup, email verification, login, refresh sessions and logout |
| Admin access | Owner bootstrap, email invitations, permissions and staff suspension |
| Plots | Listing details, pricing, photo uploads, map boundaries and publication checks |
| Buyer library | Saved plots, reservations and access dates |
| Payments | Hosted Paystack checkout, server verification, webhooks and receipts |
| Documents | Uploads, visibility controls, buyer assignment, downloads and version history |
| Co-ownership | Published terms, requests, partner proposals, acceptance, recorded contributions and allocations |
| Buyers & ownership | Real customer accounts, linked records, contact details and private staff notes |
| Communications | Announcements, buyer notifications and backend activity history |
| Settings | Admin settings, buyer contact profiles and owner-only reservation defaults |

Some site-check screens, legacy ownership views and preferences still contain browser-local preview features. These are not authoritative ownership records. The separate admin Verification queue has been removed; plot verification status remains in the plot editor.

**Payments currently use Paystack test mode.** The interface uses normal payment wording for demonstrations, but the backend accepts test credentials only. Live settlement, automatic co-ownership contributions, escrow and refund processing are not implemented. Recording an allocation does not itself transfer legal title.

## Local setup

### Requirements

- Node.js **22.12+**, or a supported newer LTS, and npm.
- PostgreSQL with permission to apply migrations.
- SMTP credentials for verification and invitation emails.
- Cloudinary credentials for photo uploads.
- Paystack test credentials for reservation checkout.

### 1. Install and configure

Clone the repository and install from its root:

```sh
git clone https://github.com/themiraiadvantage/mirai-platform.git
cd mirai-platform
npm ci
```

Create local environment files:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

On macOS/Linux, use `cp` instead of `Copy-Item`. Fill in the placeholders before starting the apps.

| File | Configuration |
| --- | --- |
| `backend/.env` | Database URL, JWT secret, SMTP, Cloudinary, Paystack and application origins |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`; optional site and map settings |

Use **DATABASE_URL** for both Prisma migrations and the API. There is no separate direct connection variable. Keep service secrets on the backend; never put them in a `NEXT_PUBLIC_*` variable. Local environment files are ignored by Git.

Generate a JWT secret with:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

### 2. Prepare the database

```sh
npm run db:generate --workspace @mirai/backend
npm run db:migrate
```

Migrations create the application schema. Accounts and listings are created through the application; no default admin password is provided.

### 3. Start both apps

In one terminal:

```sh
npm run dev:api
```

In another terminal:

```sh
npm run dev
```

- Website: http://localhost:3000
- Buyer login: http://localhost:3000/sign-in
- Admin login: http://localhost:3000/admin/login
- API health: http://localhost:4000/api/v1/health

If port 4000 is occupied, check whether the backend is already running before starting another instance. A backend launched with `start` needs a rebuild and restart to pick up source changes.

## First admin account

For a fresh database, build the backend and send the initial owner invitation:

```sh
npm run build --workspace @mirai/backend
npm run admin:bootstrap --workspace @mirai/backend -- --email owner@example.com
```

The owner receives a single-use password setup link that expires after 24 hours. There is **no shared default password**. Bootstrap refuses to create another initial owner once staff already exist.

After signing in, the owner invites the team through **Staff & access**. Normal admins receive operational access. Staff management and protected platform defaults require Super Admin authority. Public signup cannot create staff accounts.

## Typical workflow

1. An admin creates a draft plot, enters details and pricing, and saves it.
2. The admin uploads photographs and a public listing document, adds map boundaries, resolves the publication checklist and publishes.
3. A verified customer explores plots, saves a shortlist or pays the configured reservation fee through Paystack.
4. The backend verifies payment before activating the reservation and updating the buyer library, admin records and notifications.
5. Admins assign buyer documents and track customer records. For co-ownership, publish terms, receive requests, propose partners and obtain both acceptances before recording contributions and allocations.

Cloudinary stores plot photos. PostgreSQL stores document bytes and version history, served through access-controlled endpoints. Public listing documents and private buyer documents have separate visibility rules.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend development server |
| `npm run dev:api` | Compile and watch backend |
| `npm run build` | Build both applications |
| `npm run typecheck` | Type-check both applications |
| `npm run test --workspace @mirai/frontend -- --maxWorkers=2` | Run frontend tests |
| `npm run test --workspace @mirai/backend` | Build and run backend tests |
| `npm run test:e2e --workspace @mirai/backend` | Run authentication database integration tests |
| `npm run db:migrate` | Apply committed migrations |
| `npm run start` | Start built frontend |
| `npm run start:api` | Start built backend |

Additional database-backed suites in `backend/test` opt in with `RUN_DATABASE_TESTS=1`. They use disposable schemas and synthetic records, mock external services and clean up afterwards. The database role must be able to create schemas. These tests do not reset application tables.

## Repository layout

```text
frontend/
  src/app/           Public, buyer and admin routes
  src/features/      Product features and connected screens
  src/components/    Shared UI and maps
  src/lib/           API clients, sessions and utilities
  src/test/          Frontend tests
  public/            Brand assets and static files
backend/
  src/               API modules and domain services
  prisma/            Schema and migrations
  scripts/           Bootstrap and maintenance utilities
  test/              Unit and database integration tests
  docs/              Domain implementation notes
```

## Deployment

Build both apps, apply migrations and run the frontend and API as separate processes. Configure HTTPS origins using `API_URL`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL` and the site URL where needed. Frontend and API should share the same site, such as `www.example.com` and `api.example.com`, for the refresh-cookie policy.

Paystack webhooks need a publicly reachable HTTPS API; localhost is not reachable by the provider. Local checkout uses return-page verification. A deployed checkout should also configure `/api/v1/payments/paystack/webhook`.

Keep credentials outside source control. Set up monitoring, backups and retention policies before launch. Rate limiting currently uses per-process memory; multiple API instances need a shared throttling strategy. Review remaining preview screens and the test-only payment restriction before production rollout.

## Documentation

- [Backend setup and API notes](backend/README.md)
- [Frontend development](frontend/README.md)
- [Co-ownership implementation](backend/docs/co-ownership.md)
- [Paystack test checkout](backend/docs/paystack-test-checkout.md)
