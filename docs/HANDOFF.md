# 2026-11-09 implementation handoff

Target GitHub account: `tsuhasqni-pixel`; repo: `web-app-data`.
The sibling `web-app-stock` is empty as of the initial audit and MUST NOT be modified by this PR.

## Implemented
Free/Pro workspace separation: Free cleaning diagnosis + safe process preview; Pro multi-sheet batch cleaning with local ZIP export, plus separate Aggregation and Balance-sheet Layout tabs.

Browser-only CSV/TSV and XLSX parsing, manual header choice, Auto/Long/Wide orientation selection with explicit wide-to-long expansion, rule-based column mapping, safe normalization, source provenance, before/after, validation, user-configured aggregation, balance-sheet layout preview with explicit account classification, DemandScope/Inventory/Generic CSV export, Recipe v2 persistence, 20 synthetic regression scenarios, D1 schema-only migration, Cloudflare assets configuration, and CI dry-run validation.

## Verification still required
Run `npm install && npm test && npm run build` and inspect GitHub Actions on the exact branch head. Test uploaded CSV and XLSX manually in Chrome, Edge, Safari. Do not declare production-ready.

## Known gaps
Wide-to-long exists for recognized date/month headers, but complex merged-header pivoting is not covered. No Shift-JIS decoder, formula/merged-cell browser E2E, calibration of confidence, persisted remote recipes, Stripe entitlement/backend enforcement, live D1 binding, Auth Mail Gateway E2E, or Cloudflare production deployment. Actual inventory app field specification is not yet established. No real enterprise data has been used.

## Cloudflare deployment gate
New Cloudflare account ID and project name must be read and matched before attaching workers builds or secrets. Never deploy to the old account based on inferred names. No auto merge to main.


## Current auth/billing decision
End-user GitHub OAuth will not be used. Stripe remains product entitlement/billing authority; shared Auth Mail Gateway is reserved for email-possession verification and cross-device recovery. See `docs/AUTH_BILLING.md`.
