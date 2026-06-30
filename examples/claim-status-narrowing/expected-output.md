# Expected Output

When `claimStatus` is `needs-confirmation`, the gate can return `update_rail`.
The operator should narrow the claim and rerun with `can-claim` only when the scoped claim is true.
