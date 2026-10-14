# Personal profile UI

Signed-in Admin, Operations Manager, Technician, Seller, Seller Staff and Customer can open `/ho-so` from account/workspace navigation.

- Save name, optional phone/address; login email is read-only.
- Contact email defaults to login email. Request and verify an OTP before activating a different address; reset returns to the login default.
- Declare/change a personal bank with a review-and-confirm step. Numbers are masked until explicitly revealed, cleared on page hiding/logout/identity switch, and never cached as profile query data. Personal bank is separate from shop withdrawal details.
- Drafts survive background refresh for the same identity, but are reset when the signed-in account changes.

API responses use generated contracts from backend OpenAPI (`pnpm contracts`); do not hand-edit generated files. Portal tests in `tests/portal/personal-profile.spec.ts` use mock network responses and never deliver real emails. Run them with the portal Playwright configuration; actual delivery requires a manual inbox check against the local backend.
