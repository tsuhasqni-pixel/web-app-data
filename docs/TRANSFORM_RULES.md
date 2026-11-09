# Transform rules

The MVP follows: Inspect → Detect → Map → Confirm → Transform → Validate.

Safe defaults:
- trim surrounding whitespace: ON
- Unicode width normalization (NFKC): ON
- recognized date normalization: ON

Dangerous transforms are intentionally absent/off:
- NULL → 0
- negative quantity → 0
- fuzzy SKU mutation
- duplicate aggregation
- subtotal/total deletion
- implicit unit conversion

A warning is not permission to mutate a value. Every destructive rule added later must produce an audit entry explaining the before/after value and rule.
