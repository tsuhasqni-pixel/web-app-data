# Data Shaper — Owner Launch Handoff 2026-11-12

## Current state

Status: SALE_RC / LIVE OFF

Created in Stripe LIVE:
- Lite Product: prod_Vc9LJeugC9FABc
- Lite Price: price_1Uav2zBGa8rL8jwIJtqLaBJC — JPY 480/month
- Pro Product: prod_Vc9MxlPOFViYQg
- Pro Price: price_1Uav3IBGa8rL8jwIJcEFxAFI — JPY 980/month
- Product statement descriptor: DATASHAPER
- Portal config: bpc_1Uav4GBGa8rL8jwIqg24naP8
- Portal login: https://billing.stripe.com/p/login/3cIbJ02U7gen5u6bhn93y01
- Webhook endpoint: we_1Uav4YBGa8rL8jwIomFuWnxK
- Webhook URL: https://web-app-data.data-analist.workers.dev/api/billing/webhook

Customer totals:
- Free: JPY 0
- Lite: JPY 480/month
- Pro: JPY 980/month
- Operator status supplied by owner: consumption-tax exempt operator
- Stripe Tax automatic add-on: not used

## Owner-only actions

### 1. Cloudflare Production secrets
Open the Data Shaper Worker production settings and set:
- STRIPE_LIVE_SECRET_KEY
- DATA_SHAPER_STRIPE_LIVE_WEBHOOK_SECRET
- GOOGLE_OAUTH_CLIENT_SECRET
- SESSION_SECRET

Do not paste secret values into GitHub, README, Issues, PRs, or chat.

Non-secret IDs are already wired in wrangler.jsonc:
- DATA_SHAPER_STRIPE_LIVE_LITE_PRICE_ID
- DATA_SHAPER_STRIPE_LIVE_PRO_PRICE_ID
- DATA_SHAPER_STRIPE_LIVE_PORTAL_CONFIG_ID

Keep these OFF for now:
- DATA_SHAPER_LIVE_BILLING_ENABLED=false
- DATA_SHAPER_REFUND_POLICY_CONFIRMED=false
- DATA_SHAPER_LIVE_SALE_APPROVED=false

### 2. Google OAuth
Production callback must match:
https://web-app-data.data-analist.workers.dev/api/auth/google/callback

### 3. Confirm published cancellation/refund policy
Current policy:
- monthly auto-renewal
- cancellation at period end
- no normal prorated refund for user-initiated mid-period cancellation
- billing errors / duplicate charges / legally required cases handled separately

After owner confirmation, DATA_SHAPER_REFUND_POLICY_CONFIRMED may be set true.

### 4. Final real-card E2E
Only after readiness is green:
1. enable LIVE billing temporarily for the owner test
2. purchase Lite once
3. verify Lite entitlement
4. purchase/upgrade to Pro only if needed for the test plan
5. verify Pro entitlement
6. open Customer Portal
7. set cancellation at period end
8. confirm webhook backlog is zero
9. confirm entitlement lifecycle
10. record final SHA, Cloudflare Version ID, Stripe Customer/Subscription IDs

### 5. Public sale switch
Only after the real-card E2E passes:
- DATA_SHAPER_REFUND_POLICY_CONFIRMED=true
- DATA_SHAPER_LIVE_SALE_APPROVED=true
- DATA_SHAPER_LIVE_BILLING_ENABLED=true

## Assistant-owned work already completed
- code/security/file-processing audit
- Japanese/English UI audit
- generic self-employed/freelancer reporting
- Stripe LIVE Lite/Pro products and prices
- Portal config
- Webhook endpoint
- GitHub/Cloudflare sale RC gates
- legal/commerce/billing pages
- price display confirmation
