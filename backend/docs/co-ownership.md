# Plots and co-ownership

All records use the configured `DATABASE_URL`. The migration adds new tables without importing browser sample records.

## Start using it

1. In Admin → Plots, create and save a draft. Add surveyed boundaries, a photo and a public listing document. Enter pricing, fees and site findings, then publish.
2. Admin can enable co-ownership and save its contribution period and planned deposit percentage at any stage. Buyer offers and new requests require a published, available, verified plot of at least 500 sqm. The current model has two equal shares.
3. The Super Admin publishes the platform's co-ownership terms in Admin → Co-ownership. Terms are immutable versions; publishing revisions does not rewrite accepted requests.
4. A verified buyer chooses an offer, reviews the contribution breakdown, accepts the current terms and submits a request. The request snapshots that price and policy. Submission does not collect money.
5. Admin selects two compatible waiting requests and writes the proposed agreement. The plot becomes reserved. Both buyers receive an in-app notification and must independently accept that exact match.
6. Once both accept, admin can enter confirmed contributions with unique external payment references. Retries with the same data do not duplicate payments; overpayments and reused references are rejected.
7. After both buyers have fully contributed, upload separate private PDF allocation documents on the plot. Admin records each portion and its document. The plot becomes sold; each buyer can download only their own allocation PDF.

## States

| Request | Meaning |
| --- | --- |
| WAITING | Saved request, no match proposed |
| PROPOSED | Plot reserved; both partners review the immutable agreement |
| ACTIVE | Both partners accepted; confirmed contributions can be recorded |
| ALLOCATED | Both balances complete and separate allocation documents recorded |
| CANCELLED | Request cancelled before activation |

Cancelling a proposal returns the remaining buyer to WAITING and releases the plot. Active partnerships cannot be cancelled through the simple cancellation endpoint; exits and refunds need a separate agreed process. No refund is implied or processed by cancellation.

## API areas

- `/api/v1/admin/plots`: authenticated listing create/update, draft reads, file uploads and removal. Optimistic listing versions prevent overwriting another editor's changes.
- `/api/v1/plots`: published listing reads and public listing files. Staff-only notes and private files are excluded.
- `/api/v1/admin/co-ownership`: permission-checked requests, partner candidates, proposals, versioned policies, contribution confirmation and allocation.
- `/api/v1/co-ownership/offers`: published, verified and explicitly enabled available plots with the current policy.
- `/api/v1/co-ownership`: authenticated buyer requests; summary; exact-match acceptance; cancellation; allocated-document downloads.
- `/api/v1/notifications`: announcement and ownership updates share the existing private inbox and unread tracking.
- `/api/v1/admin/activity`: transactional events for listing, file, policy, request, agreement, contribution and allocation changes.

Lists are paginated. Administrative mutations, notifications and audit entries commit in the same transaction. Short domain locks and database uniqueness constraints prevent simultaneous matches for the same plot and duplicate active requests for one buyer/plot.

## Files and payments

Plot photos are uploaded to Cloudinary using the server-only `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in `backend/.env`. PostgreSQL stores their Cloudinary identifiers and URLs. Authenticated originals and signed delivery URLs keep draft images behind the admin access check; published photo requests redirect to Cloudinary for image delivery. Document bytes remain in PostgreSQL with the existing visibility and ownership checks. Supported files are PDF, PNG, JPEG and WebP, up to 5 MB each, with a maximum of 30 files per plot. Public listing documents become public when the listing is published. Allocation files must use private visibility. Files attached to completed allocations cannot be removed.

Cloudinary uploads happen outside database transactions. A durable cleanup queue handles failed saves and deleted photos, retries every minute while the backend is running, and protects committed photos from accidental deletion. In-flight upload cleanup has a one-hour grace period. Run `node scripts/migrate-plot-photos.cjs` after building and migrating to move any existing database photos to Cloudinary. Run `node scripts/check-cloudinary.cjs` for a temporary real upload/delivery check that removes its test image afterward.

This implementation records manually verified external payments. It does not charge cards, move money, create escrow accounts, process refunds, or automatically assess missed instalments. A payment-provider integration and a financial correction/exit workflow are separate work.
