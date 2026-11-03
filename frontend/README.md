# MIRAI frontend

Next.js App Router application for the public website, buyer dashboard and admin portal. See the [root README](../README.md) for setup, feature status and deployment notes.

## Development

From the repository root:

```sh
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` in this directory and configure `NEXT_PUBLIC_API_URL`, including `/api/v1`. Start the API separately with `npm run dev:api`.

## Checks

```sh
npm run typecheck --workspace @mirai/frontend
npm run test --workspace @mirai/frontend -- --maxWorkers=2
npm run build --workspace @mirai/frontend
```

## Structure

- `src/app`: public pages, authentication, buyer and admin routes.
- `src/features`: connected screens and remaining preview components.
- `src/components`: shared UI, maps and primitives.
- `src/lib`: API clients, session helpers and utilities.
- `src/test`: component and user-flow tests.
- `public`: logos, imagery and static assets.

The API enforces authentication and staff authorization. Access tokens stay in memory; an HttpOnly refresh cookie restores sessions. Local preferences do not grant staff permissions or establish ownership.

The catalogue, saved plots, reservations, payments, documents, co-ownership, announcements and buyer contact profiles use backend endpoints. Some legacy screens and preferences still use preview data. Paystack remains in test mode even where the interface uses normal payment wording.

Never expose backend credentials through frontend environment variables. Read the local Next.js documentation under `node_modules/next/dist/docs` before changing framework-specific behavior, as required by AGENTS.md.
