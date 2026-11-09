# 2026-11-09 implementation handoff

Target GitHub account: `tsuhasqni-pixel`; repo: `web-app-data`.
The sibling `web-app-stock` is empty as of the initial audit and MUST NOT be modified by this PR.

## Implemented
Browser-only CSV/TSV and XLSX parsing, manual header choice, rule-based column mapping, safe normalization, source provenance, before/after, validation, DemandScope/Inventory CSV export, downloaded JSON recipes with exact header matching, 20 synthetic regression scenarios, D1 schema-only migration, Cloudflare assets configuration, and CI dry-run validation.

## Verification still required
Run `npm install && npm test && npm run build` and inspect GitHub Actions on the exact branch head. Test uploaded CSV and XLSX manually in Chrome, Edge, Safari. Do not declare production-ready.

## Known gaps
No wide-to-long pivot, Shift-JIS decoder, formula/merged-cell browser E2E, calibration of confidence, persisted remote recipes, Stripe/OAuth, live D1 binding, or Cloudflare production deployment. Actual inventory app field specification is not yet established. No real enterprise data has been used.

## Cloudflare deployment gate
New Cloudflare account ID and project name must be read and matched before attaching workers builds or secrets. Never deploy to the old account based on inferred names. No auto merge to main.
