# Reservation checkout in Paystack test mode

The supplied keys are stored in `backend/.env`, which is ignored by Git. Neither key is returned to the browser. This implementation uses server-initialized hosted checkout and currently accepts **test keys only**.

## Try the buyer flow

1. Build the backend (`npm run build` in `backend`), stop its existing process and restart it with `npm start`. Keep the frontend running.
2. Sign in with a verified customer account, not a staff account.
3. Open a published, available plot in **Explore plots**. Click **Reserve this plot**, review the fee and access period, and accept the test terms.
4. Continue to Paystack. Successful test card: `4084084084084081`, CVV `408`, any future expiry. See [Paystack test payment details](https://paystack.com/docs/payments/test-payments/).
5. After checkout, MIRAI verifies the reference with Paystack. A successful, eligible reservation appears in **Land Library**, **Payments**, **Documents** (listing documents) and **Notifications**. Admin **Reservations**, **Payments**, **Overview** and **Activity history** use the same database records.
6. If you close checkout or lose the return page, open **Payments** and click **Check payment status**. Pending checkouts have a link to continue payment.

No real money is collected. Test receipts are explicitly labelled. This fee is separate from the land price and the co-ownership deposit. Land instalment checkout, automatic refunds, automatic renewal and transferring ownership are not part of this reservation checkout.

## Confirmation and availability

- Amount and currency come from the backend, not the browser. Verification checks the saved reference, amount, NGN currency, test mode and customer email.
- The checkout claim lasts 20 minutes. Another customer cannot open a competing checkout while that claim is valid. The plot becomes **Reserved** only after verified success.
- An active reservation lasts the plot's saved access period. A worker releases expired reservations; no renewal is charged automatically.
- Repeated callbacks/webhooks reuse the payment reference and create no duplicate payment, reservation, notification or success audit entry.
- A successful late payment is recorded as paid but its reservation becomes **REVIEW_REQUIRED** if it cannot safely be granted. Both buyer and admin see the reason. Staff must handle any resolution separately; the app does not claim that a refund happened.
- Staff cannot change publication/availability over an open checkout or active reservation. Co-ownership proposals cannot claim such a plot either.

## Webhooks

The endpoint is `POST /api/v1/payments/paystack/webhook`. It authenticates the raw request bytes with Paystack's SHA-512 signature, then independently verifies the transaction before committing records.

For hosted deployment, configure your publicly reachable HTTPS API URL plus that path in the **Paystack test webhook settings**. Paystack cannot call a localhost URL. Local testing works through the authenticated return-page verification and **Check payment status**; webhook delivery requires a public endpoint or tunnel.

## Checks

- `node scripts/check-paystack.cjs` initializes an unpaid test checkout and verifies its amount, currency and test mode, without charging it or printing credentials.
- `RUN_DATABASE_TESTS=1 node --test test/reservations.test.cjs` runs lifecycle tests in a temporary PostgreSQL schema. On PowerShell set `$env:RUN_DATABASE_TESTS='1'` first.
- Frontend tests include checkout consent, the signup/login return path, server-confirmed callbacks, unavailable plots and test receipts.
