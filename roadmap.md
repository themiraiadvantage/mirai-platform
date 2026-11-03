# MIRAI delivery status

## Frontend delivered

- [x] Next.js App Router migration, without TanStack
- [x] Gold, Marine Deep and white design system, responsive public pages and animated contour hero
- [x] Catalogue filters, saved plots, comparison, map and boundary fallback
- [x] Plot costs, payment plans, sample documents and site assessments
- [x] Connected signup, email code verification, resend cooldown, login, session refresh and logout
- [x] Buyer shell, Land Library, ledger, vault, notifications and settings
- [x] Local reservations/instalments and downloadable demo receipts
- [x] Co-ownership costs, preferences and matching state
- [x] Staff sandbox, review queues, audit CSV and staff management
- [x] Route boundaries, trust/privacy/terms pages and SEO metadata
- [x] Tests for account separation, reservations, payments and return paths

## Buyer workspace coverage

The buyer dashboard now keeps discovery and purchase tracking inside `/dashboard`:

- `/dashboard/explore`: state, location, size, price, plan, document verification and site-status filters; grid, list, map, saved plots and comparison.
- `/dashboard/explore/[code]`: full plot details, boundary map, beacons, documents, site findings, itemised costs and reservation terms.
- `/dashboard/library`: owned/reserved and saved plots, per-plot stage, progress and first-time guidance.
- `/dashboard/plots/[code]`: ownership overview, reservation/access dates, land balance, next due date, verification issues, payments/receipts, document history, map, assessments, activity and completion requirements.
- `/dashboard/payments` and `/dashboard/documents`: portfolio summaries that open the relevant tab in the plot record.
- `/dashboard/co-own` and `/dashboard/co-own/start`: matching state and proposed contribution/allocation workflow, with commercial and legal terms still to confirm.
- `/dashboard/notifications`: payment, document, verification, site, announcement and matching categories, scoped to accessible buyer records.
- `/dashboard/profile`: top-bar account entry, profile, notification preferences and session information. The old settings route redirects here.
- `/dashboard/guide`: the seven-step buyer journey, fees, access renewal, cancellation, site-check limitations and co-ownership guidance.

Signup, code verification and sign-in preserve the original workspace destination, including its query and fragment. Public plot destinations are mapped into workspace exploration after authentication.

This completes the buyer-facing screen structure, not the production services below. Authentication is connected; property records, preferences, matching and payments remain browser-local demonstrations. Real evidence, professional sign-off, legal completion, persistent records and Paystack integration must be implemented before live use. Staff permissions, publishing, audits and operational metrics belong in the separate staff workspace, not buyer navigation.

## Production services still required

- [ ] Authoritative inventory and licensed survey evidence
- [x] Real authentication and secure refresh cookies using NestJS, Prisma and Neon PostgreSQL
- [ ] Server-enforced staff permissions for operational features
- [ ] Verified Paystack checkout, webhooks and reconciliation
- [ ] Durable customer records, signed documents and immutable audit storage
- [ ] Inspection scheduling and specialist review evidence
- [ ] Staff-to-catalogue publishing and actual messaging
- [ ] Real partner matching and reviewed allocation agreements
- [ ] Reviewed commercial/privacy policies and compliance implementation
- [ ] Automated PDF receipts and legal document generation
- [ ] Production performance, security and accessibility audits
