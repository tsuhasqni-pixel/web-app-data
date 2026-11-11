# Data Shaper — Inventory Data Normalizer

Local-first data preparation workbench for company CSV/XLSX data.

Status: **development / not production-ready**. No customer data is uploaded to a server. Review every inferred mapping and destructive transformation before export.

## Six-stage workflow
Inspect → Detect → Map → Confirm → Transform → Validate.

## Repository policy
- Main is protected by workflow convention: changes via `codex/*` draft pull requests.
- No automatic production deployment, payment activation or customer-data ingestion.
- Cloudflare account and project bindings are **not configured** until separately verified.
- Do not commit secrets or actual client spreadsheets.

See development branch for the initial implementation.


## Pro aggregation and trial-balance workflow
- Aggregation lets the user choose primary/secondary axes, numeric target, and aggregation method.
- The result can be returned immediately as a CSV after calculation.
- Trial-balance layout uses deterministic programmed account-name rules for current assets, non-current assets, current liabilities, non-current liabilities, and equity.
- Unclassified or ambiguous accounts are never silently assigned; the user can override them.
- If only debit/credit columns exist, natural-side balances are derived after section classification.
- Balance reconciliation reports whether assets equal liabilities plus equity. Any unclassified account prevents a PASS.
- Uploaded source files remain Local First and are not stored by the Worker.
