# Data Shaper Stripe billing boundary

## Current state

Billing remains disabled by default:

```text
DATA_SHAPER_BILLING_ENABLED=false
```

Google OAuth is identity-only. Stripe is the only source of truth for Data Shaper Pro.

## Test-only runtime settings

The current scaffold intentionally accepts TEST-mode Stripe credentials only.

```text
STRIPE_TEST_SECRET_KEY=<sk_test_... or rk_test_...>
DATA_SHAPER_STRIPE_TEST_PRICE_ID=<Data Shaper-specific price_...>
DATA_SHAPER_STRIPE_WEBHOOK_SECRET=<whsec_...>
DATA_SHAPER_BILLING_ENABLED=false
```

Do not reuse DemandScope or NamiData Product / Price IDs.

## Endpoints

- `GET /api/billing/status` — secret-safe readiness
- `POST /api/billing/checkout` — authenticated, same-origin, subscription Checkout; disabled unless billing flag is true
- `POST /api/billing/portal` — authenticated Stripe Customer Portal
- `POST /api/billing/webhook` — Stripe signature verification before D1 mutation

## Identity and entitlement flow

```text
Google sub
  -> internal Data Shaper user_id
  -> Stripe Customer
  -> Data Shaper-only Subscription
  -> stripe_entitlements(product_key=data-shaper-pro)
  -> Pro
```

Email is not an entitlement key.

## Webhook handling

The handler verifies the raw request body against the Stripe-Signature `v1` HMAC SHA-256 signature with a 5 minute timestamp tolerance.

Handled events:

- `checkout.session.completed` -> internal user_id ↔ Stripe Customer
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Subscription events update D1 using `product_key=data-shaper-pro`. Duplicate deliveries are idempotent because customer and subscription rows are upserts.

## HOLD before enabling billing

Do not set `DATA_SHAPER_BILLING_ENABLED=true` until all are true:

1. A Data Shaper-specific Stripe TEST Product and recurring Price exist.
2. Tax treatment has been explicitly decided; no tax behavior is guessed.
3. The webhook endpoint exists in Stripe TEST mode and its signing secret is installed.
4. Checkout → webhook → D1 entitlement → Pro UI passes E2E.
5. Customer Portal returns to the Data Shaper origin.
6. No DemandScope or NamiData Product / Price IDs are present.
7. Live billing remains separately gated.
