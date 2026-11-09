# Security / privacy

## Local-first rule
Raw CSV/XLSX input is parsed in the browser. The MVP makes no application API request containing uploaded workbook content and does not persist raw input to D1/R2.

## Never log
- company/customer names from input
- SKU names/codes from input
- sales, demand or inventory values
- raw rows or workbook cells

Allowed operational telemetry, if introduced later, is structural only (file type, row/column counts, success/failure flags) and must exclude raw values.

## Production gates
Do not add OAuth, Stripe, D1, R2 or customer uploads until the correct Cloudflare account/project is explicitly verified. Never commit credentials. Production deployment and merge remain separate from CI success.
