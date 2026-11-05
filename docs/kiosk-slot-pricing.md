# Kiosk rental by requested slot allocation

Aligned with BE `fa3187b` and the business decision dated 2026-11-04.

- `/api/kiosk-packages` returns one pricing object, not an array of packages.
- Only Operations Manager can edit the two annual prices. Writes include the
  viewed `expectedVersion`; a 409 requires reloading and reviewing before saving.
- `/thue-kiosk` supports first-time Customer rental and additional Seller rental.
  Whole-number demand must total 1–50 slots. Either type can be zero.
- The form shows unit prices, demand, annual fee and the 12-month handover term.
  It requires explicit confirmation before submitting. A new pricing version
  invalidates confirmation; failed writes never resubmit automatically.
- Customer requests retain the shop/contact/bank/location fields. Seller requests
  send only location, demand and `pricingVersion` to `/api/me/kiosk-applications`.
  Neither request sends `sellerId`, a client-computed fee or `packageId`.
- Application displays use saved unit prices and `annualFee`, independent of the
  current pricing table. Historical package applications remain readable.
- Payment links, server reconciliation and application lifecycle remain in the
  existing flow; browser redirects do not confirm payment.
- Managers enroll devices from a CONFIRMED application. `applicationId` determines
  slot count and zones. Device enrollment has no editable slot count or zone.
  Scheduling reads eligible kiosks using that application ID.
- Seller stock views show backend-provided zones and permit stocking only the
  matching Walk-in slots. Unknown historical zones remain unclassified and cannot
  be stocked. No role-facing zone mutation control remains.
- The public homepage provides an annual per-slot fee calculator and links into
  the authenticated application flow. The old package-based consultation form and
  monthly renewal controls are removed. No replacement renewal API is invented.

Contracts are exported from the sibling BE using its `--export-openapi` workflow
and generated with openapi-typescript. No database initialization is required.

Verification is covered by slot-pricing, onboarding, storefront, stock and rental
screen browser tests, plus onboarding validation unit tests. Browser fixtures mock
HTTP: they do not establish actual payOS settlement, database migrations, role
promotion at handover or physical kiosk behavior. Deploy the matching BE migration
`20261104_requested_kiosk_layout_pricing.sql` before using the new client.
