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


## Template-first accounting aggregation
The accounting workflow is template-first, not a generic statistical GROUP BY workflow.

1. Prepare or import a statement template containing the target account rows.
2. Upload a trial balance and map its account / amount (or debit / credit) columns.
3. Match each source account to a template account. Multiple source accounts may roll up into one template row.
4. Keep unknown accounts unresolved until a human maps them; never silently discard them.
5. Calculate the statement template and verify Assets = Liabilities + Equity.
6. Return the calculated CSV immediately; the source file remains Local First.

Template columns:
- `order`
- `section` (current_assets / noncurrent_assets / current_liabilities / noncurrent_liabilities / equity)
- `account`
- `aliases` (pipe-separated)
- `normal_balance` (debit / credit)

The starter template is only a practical Japan-GAAP balance-sheet starter. It is not claimed to be a complete EDINET taxonomy. EDINET/XBRL extraction and PDF/OCR ingestion can populate the same template model in later stages.


## Simple aggregation vs accounting
- **Aggregation** is a generic two-field operation: choose one field to group by and one numeric field to sum.
  - Example: `商品` → group key, `価格` → numeric field. Repeated rows for 商品A are summed.
  - No accounting template is involved.
- **Statement layout** is the accounting workflow. It owns the statement template, trial-balance account mapping, many-to-one account rollups, and balance-sheet reconciliation.
