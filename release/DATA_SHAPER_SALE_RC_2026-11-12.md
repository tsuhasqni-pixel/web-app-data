# Data Shaper SALE_RC Package — 2026-11-12

Status: **SALE_RC / LIVE HOLD**

Repository: `tsuhasqni-pixel/web-app-data`
Audited executable head: `dfaa39795e6dbfb9e83cd90fe7b3d3a4df5f6f2b`
Test gate: **86 unit tests + 5 browser E2E PASS**

## Web release package

Data Shaper is a web product. Its sale package is the immutable Git commit plus the exact Cloudflare Worker build; there is no desktop installer.

Included:
- Free / Lite / Pro tier surfaces
- Japanese / English UI
- Local-first CSV / TSV / XLSX processing
- aggregation / reports / accounting preparation
- tax-rule and depreciation helpers
- CSV / XLSX / PDF / ZIP output
- Google OIDC identity
- Stripe TEST / LIVE billing architecture
- D1 entitlement / webhook evidence
- legal consent and sales pages
- browser and file security hardening
- CI sale gates

## Promotion sequence

1. Merge audited hardening PR.
2. Verify main CI exact-head.
3. Verify Cloudflare Worker exact-head build / Version ID.
4. Keep DATA_SHAPER_LIVE_BILLING_ENABLED=false.
5. Complete every owner gate in PRE_SALE_AUDIT_2026-11-12.md.
6. Create / verify LIVE Lite and Pro Stripe products and prices.
7. Run one real-card production lifecycle E2E.
8. Record final production SHA, Worker Version ID and Stripe live Price IDs.
9. Only then enable the final live billing / sale flags.

A preview URL, branch build or successful TEST checkout alone is not authorization to sell.
