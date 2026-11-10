# Non-mail connection handoff

This document covers the connections ChatGPT can prepare without changing the shared Auth Mail Gateway or the completed Google-verified data-science product.

## 1. Cloudflare deployment

Target Worker/project: `web-app-data`.

The Worker now exposes:

- `GET /api/integration-status`
- `GET /api/legal/disclosure`

Static application traffic continues through the `ASSETS` binding.

Production deployment remains gated. GitHub CI uses Wrangler dry-run only. Do not merge/deploy based on project-name inference; verify the intended Cloudflare account first.

## 2. Stripe TEST connection

Data Shaper is intentionally not connected to any existing DemandScope/NamiData Product or Price.

Expected variables/secrets:

```text
DATA_SHAPER_BILLING_ENABLED=false
STRIPE_TEST_SECRET_KEY=<Data Shaper TEST restricted/secret key>
DATA_SHAPER_STRIPE_TEST_PRICE_ID=<Data Shaper-specific TEST price>
DATA_SHAPER_STRIPE_WEBHOOK_SECRET=<Data Shaper-specific TEST webhook signing secret>
```

`/api/integration-status` reports only booleans; it never returns secret values.

Creating the Product/Price is intentionally separate because price/tax settings must be explicitly decided first. No live billing flag exists in this branch.

## 3. Shared legal/disclosure connection

Configure:

```text
LEGAL_DISCLOSURE_URL=https://namidata-lab-public.lingering-salad-74bc.workers.dev/legal/disclosure-request
```

The UI links to `/api/legal/disclosure`, so the destination stays server-configurable and can be changed without exposing secrets.

## Excluded from this work

- Auth Mail Gateway repository and email delivery configuration
- NamiData / the completed Google-verified data-science service
- live Stripe activation
- production Cloudflare deployment
- customer-data upload

These remain separate safety gates.
