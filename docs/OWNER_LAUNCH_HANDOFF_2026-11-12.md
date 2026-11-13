# Data Shaper — Owner Launch Handoff

更新: 2026-11-13

## 現在の状態

Status: **CODE READY / PRODUCTION SECRET HOLD**

販売コード・料金・法務導線・販売枠・Stripe LIVEオブジェクトは準備済みです。公開Workerは fail-closed で、現在は Cloudflare Production の `STRIPE_LIVE_SECRET_KEY` がStripe認証に失敗しているため新規購入を開始しません。

公開確認先:
- App: https://web-app-data.data-analist.workers.dev/
- Readiness: https://web-app-data.data-analist.workers.dev/api/billing/status

現在の公開Readinessで確認済み:
- `mode=live`
- billing / refund policy / live sale approval = true
- D1 schema ready
- webhook backlog = 0
- Live Price / Portal / Webhook IDs configured
- Launch capacity deployed
  - Lite: **15**
  - Pro: **10**
- 現在の停止理由: Live Stripe API credential verification = FAIL
- `ready_for_live=false` / `sale_gate_ready=false`

## Stripe LIVE（作成・確認済み）

- Lite Product: `prod_Vc9LJeugC9FABc`
- Lite Price: `price_1Uav2zBGa8rL8jwIJtqLaBJC` — **JPY 480/month**
- Pro Product: `prod_Vc9MxlPOFViYQg`
- Pro Price: `price_1Uav3IBGa8rL8jwIJcEFxAFI` — **JPY 980/month**
- Product statement descriptor: `DATASHAPER`
- Portal config: `bpc_1Uav4GBGa8rL8jwIqg24naP8`
- Webhook endpoint: `we_1Uav4YBGa8rL8jwIomFuWnxK`
- Webhook URL: `https://web-app-data.data-analist.workers.dev/api/billing/webhook`

Stripe account:
- charges enabled
- payouts enabled
- details submitted

Customer totals:
- Free: JPY 0
- Lite: JPY 480/month
- Pro: JPY 980/month
- monthly auto-renewal
- cancel at period end
- no ordinary prorated refund for user-requested mid-period cancellation
- duplicate/incorrect charge, serious service-side payment issue, and legally required cases are handled separately

## Launch capacity / Cloudflare free-tier guard

File parsing and analysis stay **Local First** in the browser. Customer CSV/XLSX data is not uploaded for server-side analysis.

Initial paid admission:
- Lite: 15
- Pro: 10
- total paid launch slots: 25

The remaining headroom is reserved for Free traffic, OAuth, Stripe Webhooks, D1 operations, traffic spikes, and operational margin.

Capacity behavior:
- only LIVE paid subscriptions consume launch slots
- pending Checkout reserves a slot for 30 minutes
- one user cannot consume multiple pending slots for the same plan
- failed Checkout releases its reservation
- active/trialing subscription becomes authoritative
- when full, **new Checkout stops but existing subscribers keep access**

## Owner-only action

### 1. Replace the invalid Cloudflare Production Stripe API credential

Set a valid Stripe LIVE backend API credential in:

- `STRIPE_LIVE_SECRET_KEY`

Do not paste the value into GitHub, README, Issues, PRs, logs, or chat.

The current variable exists, but the deployed Worker cannot authenticate it against Stripe. Replace the value rather than adding another guessed alias.

Also leave the existing live webhook secret configured:
- `DATA_SHAPER_STRIPE_LIVE_WEBHOOK_SECRET`

No Stripe Product/Price/Portal/Webhook recreation is required.

### 2. Deploy the latest main to the Production Worker

After the secret is corrected, deploy the latest `main`.

Latest pre-sale hardening includes:
- Lite 15 / Pro 10 capacity
- one pending reservation per user/product
- fail-closed Stripe verification
- existing-subscriber continuity

### 3. Verify the public readiness endpoint

Do not start public sales until all of these are true:

- `ready_for_live=true`
- `sale_gate_ready=true`
- `pro_ready=true`
- `lite_ready=true`
- `live_verification.pro.verified=true`
- `live_verification.lite.verified=true`
- account `charges_enabled=true`
- account `payouts_enabled=true`
- account `details_submitted=true`
- `webhook_backlog=0`
- capacity shows Lite 15 / Pro 10

## Real-card test policy

The owner-approved self-purchase requirement is **waived**. Do not spend money only to prove the owner's own subscription lifecycle.

Instead:
- Stripe LIVE objects are verified independently
- public readiness must be green
- Checkout remains fail-closed until that point
- the first real customer transaction is monitored as production validation:
  Checkout → Subscription → Webhook → entitlement → Portal

## SALE READY definition

Data Shaper is SALE_READY only when the **public Production endpoint** reports the complete live gate as green. Code/CI success alone is not enough.

Secret values must never be committed.
