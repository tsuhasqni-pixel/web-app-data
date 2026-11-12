# Data Shaper — Pre-Sale Audit 2026-11-12

## Verdict

- Functional code audit: **PASS**
- Security / auth / billing architecture: **PASS**
- File-processing safety: **PASS**
- Sale release candidate: **PASS (SALE_RC)**
- Live charging / public sale: **HOLD_OWNER**

Audited executable code head before documentation-only commits:
`dfaa39795e6dbfb9e83cd90fe7b3d3a4df5f6f2b`

Final executable CI at that head:
- Vitest: **86 / 86 PASS**
- Playwright browser E2E: **5 / 5 PASS**
- build: PASS
- Wrangler dry-run: PASS
- Worker Preview config: PASS
- GitHub Actions: v7
- runner: Ubuntu 24.04
- Node: 22.x

## Reviewed surfaces

- CSV / TSV / XLSX parsing and size limits
- aggregation and matching-format output
- CSV / XLSX / PDF / ZIP exports
- spreadsheet formula injection
- report HTML escaping
- Recipe import / limits
- accounting templates / balance checks
- period-aware tax calculation helper
- depreciation helper
- Japanese / English UI
- Google OIDC
- signed application sessions
- Stripe TEST / LIVE separation
- Lite / Pro product isolation
- Checkout / Portal / webhook flows
- D1 identity / entitlement / webhook evidence
- CSP and browser security headers
- legal / billing / commerce pages
- GitHub Actions and release reproducibility

## Sale-critical fixes made during this audit

1. Added CSP, nosniff, frame denial, referrer policy and permissions policy.
2. Added spreadsheet-formula injection mitigation for CSV / TSV exports.
3. Added expanded workbook caps: 20 sheets / 100,000 rows / 2,000,000 cells / 15 MB source file.
4. Added Recipe caps and statement-template caps.
5. Split Stripe TEST and LIVE secrets, prices, webhook secrets and portal configuration.
6. LIVE Checkout re-reads Stripe Price and verifies:
   - exact Lite ¥480/month or Pro ¥980/month
   - JPY
   - active Price
   - active Product
   - Product metadata app=data-shaper and correct tier
   - livemode=true
7. LIVE requires canonical HTTPS APP_ORIGIN.
8. Checkout requires explicit Terms / Privacy / Billing consent in both UI and API.
9. Legal version / acceptance time are recorded in Checkout metadata and D1 evidence.
10. Webhook payload is capped at 1 MB, signature checked, livemode checked and event IDs persisted for idempotency.
11. Commercial D1 tables self-ensure with CREATE TABLE IF NOT EXISTS to avoid deploy/migration ordering outages.
12. Billing / commerce pages now cover Lite + Pro and monthly auto-renewal.
13. Operator disclosure text states that requested information is provided without delay before purchase decision.
14. GitHub Actions moved to current v7, Ubuntu 24.04 pinned, Node 22.x pinned, and direct dependency versions pinned.

## Explicit owner-only gates before live public sale

Do not set the live gates true until all items are completed:

- Customer-facing total-price behavior: **CONFIRMED** — Free ¥0 / Lite ¥480 / Pro ¥980 are customer totals. Stripe Tax automatic add-on is not assumed.
  - Business-side consumption-tax filing/accounting still depends on the operator's tax status and remains separate from the in-app accounting-data tax helper.
- LIVE Stripe Products / Prices: **CREATED**
  - Lite Product: `prod_Vc9LJeugC9FABc`
  - Lite Price: `price_1Uav2zBGa8rL8jwIJtqLaBJC` — JPY 480 / month
  - Pro Product: `prod_Vc9MxlPOFViYQg`
  - Pro Price: `price_1Uav3IBGa8rL8jwIJcEFxAFI` — JPY 980 / month
  - Product metadata: `app=data-shaper`, tier=lite|pro
  - Product statement descriptor: `DATASHAPER`
- Live Customer Portal: **CREATED**
  - Portal config: `bpc_1Uav4GBGa8rL8jwIqg24naP8`
  - cancellation: at period end
- Live Webhook endpoint: **CREATED**
  - Endpoint: `we_1Uav4YBGa8rL8jwIomFuWnxK`
  - URL: `https://web-app-data.data-analist.workers.dev/api/billing/webhook`
- Configure STRIPE_LIVE_SECRET_KEY in Cloudflare Secret.
- Configure DATA_SHAPER_STRIPE_LIVE_WEBHOOK_SECRET in Cloudflare Secret.
- Live Price IDs and Portal config ID are now wired in wrangler config.
- Verify Stripe public business name / statement descriptor / support contact.
- Confirm the published refund / cancellation policy.
- Verify that the common operator-information disclosure route actually responds without delay before a customer decides to buy.
- Run one owner-controlled real-card lifecycle:
  purchase -> webhook -> Lite/Pro access -> portal -> period-end cancellation -> entitlement update.
- Only then set:
  - DATA_SHAPER_TAX_DISPLAY_CONFIRMED=true
  - DATA_SHAPER_REFUND_POLICY_CONFIRMED=true
  - DATA_SHAPER_LIVE_SALE_APPROVED=true
  - DATA_SHAPER_LIVE_BILLING_ENABLED=true

## Legal scope note

Japanese communication-sale advertising rules require core commercial terms and operator information. Some operator details may be omitted from the ad only when the site states they will be provided without delay on request and the operator can actually do so before purchase decision. The software cannot prove the real-world response operation, so that remains an owner gate.

## Residual non-blocking release-engineering item

The repository still has no committed package-lock.json. Direct dependency versions, Node and CI OS are pinned, and the deployable build is exact-SHA tested, so this is not treated as a product-safety blocker. A lockfile should still be added in a later maintenance pass for full transitive dependency reproducibility.

## Release rule

This audited code may be merged and deployed with live charging disabled as a SALE_RC.
It must not be interpreted as authorization to switch on public live billing automatically.

## Owner waiver — 2026-11-12

The owner explicitly approved launching without a real-card production lifecycle E2E because they cannot fund a live test purchase at this time.

Accepted residual risk:
- No owner-controlled live card charge has been observed end-to-end before launch.
- TEST/CI/browser E2E, live Stripe object verification, webhook/portal configuration and fail-closed runtime checks are used as launch evidence instead.
- Any missing live Secret or failed live Stripe verification must continue to block Checkout automatically.

Owner-approved launch flags:
- DATA_SHAPER_REFUND_POLICY_CONFIRMED=true
- DATA_SHAPER_LIVE_SALE_APPROVED=true
- DATA_SHAPER_LIVE_BILLING_ENABLED=true

The published refund/cancellation policy remains: monthly auto-renewal, cancellation at period end, no normal prorated refund for user-initiated mid-period cancellation, with billing errors/duplicate charges/legal requirements handled separately.
