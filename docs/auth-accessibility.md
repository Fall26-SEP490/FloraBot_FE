# Authentication UI verification - 2026-10-09

Routes: `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`,
`/admin/login`. Shared presentation is implemented by `AuthShell.tsx` and
`auth.css`; API realms, account creation and password policies remain unchanged.

## Verification

- Production build and ESLint passed.
- Full portal suite: 117 passed, including 16 authentication experience tests.
- Public pages/browser accessibility suite: 23 passed.
- Deployed Caddy/Next route smoke tests: 4 passed at localhost:8088 after updating
  the web container. Missing-token assertions now check the recovery action rather
  than the previous disabled submit button.
- Axe checks cover all five forms at 390px and 1440px, including invalid input.
  Tags include WCAG 2.0 A/AA and additional WCAG 2.1/2.2 AA checks.
- Keyboard checks verify skip navigation, first-invalid-field focus and password
  visibility controls. Server error/success feedback receives focus.
- Registration retains entered values after errors; password fields have persistent
  labels and instructions; consent has an associated error and invalid state.
- Recovery success does not disclose whether an email has an account. Missing and
  expired links provide recovery actions. A new fragment token in the same tab
  replaces the previous token; the fragment is removed from the address bar.
- Login rate limiting is reported without losing input or automatically resubmitting.
- 320px layout with text enlarged to 200% has no horizontal overflow.
- Manual desktop/mobile screenshot inspection completed. Mobile prioritizes form
  content and hides the decorative desktop panel. No new animation is introduced.
- Impeccable detector returned no findings for the edited authentication components.

## Boundaries

Browser tests simulate API responses to exercise UI states; this pass does not
verify real email delivery or replace the backend integration suite. Automated
checks and keyboard tests do not certify every WCAG criterion across the website;
NVDA/VoiceOver and real-device assistive-technology testing remain manual work.
The member/catalog navigation and catalog data are outside this authentication
revision. Existing visual assets retain the provenance recorded in `assets.md`.
