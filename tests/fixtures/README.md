# Synthetic fixture matrix

These fixtures are synthetic regression cases only. They are not claims about the frequency or exact shape of real enterprise data.

The executable matrix in `scenarios.js` contains 20 named cases matching the architecture plan:
clean, shifted header, wide format, duplicate rows, encoding boundary placeholder, full-width numbers, missing SKU, negative quantities, total rows, multi-sheet representative sheet, multi-location, mixed dates, numeric text, blank-vs-zero ambiguity, merged-header placeholder, monthly columns, wrong header, returns, duplicate SKU names, and a larger shape.

Binary XLSX-specific behavior (merged cells, formula cells, workbook metadata and actual multi-sheet file parsing) must still be covered by browser E2E fixtures before production. The unit suite intentionally does not pretend an in-memory row matrix proves those browser/XLSX behaviors.
