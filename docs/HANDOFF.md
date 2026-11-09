# 2026-11-09 implementation handoff

Target GitHub account: `tsuhasqni-pixel`; repo: `web-app-data`.
The sibling `web-app-stock` is empty as of the initial audit and MUST NOT be modified by this PR.

## Implemented
Browser-only CSV/TSV and XLSX parsing, manual header choice, rule-based column mapping, safe normalization, before/after, validation, CSV export, downloaded JSON recipes with exact header matching, and CI.

## Verification still required
Run `npm install && npm test && npm run build` and inspect GitHub Actions on the exact branch head. Test uploaded CSV and XLSX manually in Chrome, Edge, Safari. Do not declare production-ready.

## Known gaps
No wide-to-long pivot, Shift-JIS decoder, formula/merged-cell diagnostics, calibration of confidence, persisted remote recipes, Stripe/OAuth/D1, and Cloudflare deployment. Actual inventory app field specification is not yet established. No real enterprise data has been used.

## Cloudflare deployment gate
New Cloudflare account ID and project name must be read and matched before attaching workers builds or secrets. Never deploy to the old account based on inferred names. No auto merge to main.
