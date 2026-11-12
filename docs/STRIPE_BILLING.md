# Data Shaper Stripe Billing

Updated: 2026-11-12

## Roles

- Google OIDC: identity only.
- Stripe: Customer / Checkout / Subscription / Customer Portal and paid entitlement authority.
- Data Shaper D1: Google sub -> internal user -> Stripe Customer -> Stripe Subscription status.
- Google login alone never grants Lite or Pro.

## Plans

- Free: ¥0
- Lite: ¥480 / month
- Pro: ¥980 / month

The nominal price is not a substitute for the final customer-facing total. Tax treatment and the total shown at checkout must be owner-confirmed before live sale.

## TEST and LIVE isolation

TEST is the default. LIVE is selected only when `DATA_SHAPER_LIVE_BILLING_ENABLED=true`.

TEST variables:
- STRIPE_TEST_SECRET_KEY
- DATA_SHAPER_STRIPE_TEST_LITE_PRICE_ID
- DATA_SHAPER_STRIPE_TEST_PRICE_ID (Pro)
- DATA_SHAPER_STRIPE_WEBHOOK_SECRET
- optional DATA_SHAPER_STRIPE_TEST_PORTAL_CONFIG_ID

LIVE variables:
- STRIPE_LIVE_SECRET_KEY
- DATA_SHAPER_STRIPE_LIVE_LITE_PRICE_ID
- DATA_SHAPER_STRIPE_LIVE_PRO_PRICE_ID
- DATA_SHAPER_STRIPE_LIVE_WEBHOOK_SECRET
- DATA_SHAPER_STRIPE_LIVE_PORTAL_CONFIG_ID

LIVE additionally requires:
- DATA_SHAPER_TAX_DISPLAY_CONFIRMED=true
- DATA_SHAPER_REFUND_POLICY_CONFIRMED=true
- DATA_SHAPER_LIVE_SALE_APPROVED=true
- canonical HTTPS APP_ORIGIN
- D1 binding and commercial schema

## LIVE price verification

Before LIVE Checkout, Data Shaper retrieves the configured Stripe Price and requires:
- livemode=true
- active Price
- JPY
- Lite exactly ¥480/month or Pro exactly ¥980/month
- active expanded Product
- Product metadata: app=data-shaper and tier=lite|pro

Any mismatch stops Checkout.

## Checkout consent

The browser must explicitly accept the Terms / Privacy / Billing conditions.
The server also requires `accept_terms=true` and stores:
- legal version
- acceptance timestamp
- internal user ID
- tier / product key
in Stripe Checkout metadata. Completed Checkout acceptance evidence is persisted in D1.

## Webhooks

- Stripe signature is required.
- Maximum raw payload: 1 MB.
- event.livemode must match active TEST/LIVE mode.
- event ID is recorded in D1 for idempotency.
- failed events remain unprocessed so Stripe retry can be accepted.
- Subscription events update only Data Shaper product keys / configured tier prices.

## Customer Portal

Portal access requires an authenticated internal user linked to a Stripe Customer.
LIVE requires a configured live Billing Portal configuration.

## Release rule

Do not set LIVE sale gates true until the owner-only steps in PRE_SALE_AUDIT_2026-11-12.md are complete.
