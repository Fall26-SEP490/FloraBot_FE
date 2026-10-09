# Dashboard interface verification

Date: 2026-10-09

## Scope

Shared navigation, header and form presentation for `/admin`, `/seller`, `/staff`
and their existing business pages. Overview data comes from the existing scoped
read APIs. Permissions, financial commands, confirmations and task transitions
remain in their existing modules.

Admin overview reads open incidents, submitted reports and the first page of
preorders. Seller overview reads products, wallet and preorders. Lists show up to
five entries with a link to the complete module; they do not represent global
counts. API errors have independent retry controls. Null wallet balances never
appear as a fabricated zero. Staff keeps its paginated assigned-task workflow.

## Verification

- `pnpm lint`: passed.
- `pnpm build`: passed, including Next.js TypeScript validation.
- `pnpm test:portal`: 125 passed, covering authentication, navigation, products,
  inventory, subscriptions, bank details, payouts, refunds, incidents and staff
  assignment/report/evidence workflows.
- New dashboard tests cover all three roles at 390px and 1440px, scoped reads,
  Escape focus recovery, independent feed failure/retry and null financial data.
- Axe scans use WCAG 2.0 A/AA, 2.1 AA and 2.2 AA tags. No automated violations
  occurred in the tested dashboard states.
- The seller empty-wallet state reflows at 320px with 200% root text size.
- Visual inspection includes all three overview roles on desktop/mobile and staff
  assignment, task details and incident reporting forms.
- Impeccable source detector returned no findings for the four dashboard modules.
- Local Docker deployment at `http://localhost:8088` was rebuilt and restarted.
  All eight dashboard scenarios also passed against that deployed frontend with
  API fixtures; four deployed route/authentication smoke checks passed separately.

Screenshots in ignored `artifacts/dashboard-new-*.png` use deterministic API test
fixtures. Their names, tasks and balances are test data, not production metrics.

## Limits

Browser tests stub API responses to verify UI behavior; they are not a new
end-to-end certification of database or hardware behavior. Automated checks and
selected keyboard/reflow checks do not establish full-site WCAG conformance.
Screen-reader evaluation and an exhaustive manual WCAG audit remain separate.
