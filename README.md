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
