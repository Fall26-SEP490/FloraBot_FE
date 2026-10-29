# Personal profile UI

Signed-in Admin, Operations Manager, Technician, Seller, Seller Staff and Customer can open `/ho-so` from account/workspace navigation.

- Save name, optional phone/address, gender and date of birth; login email is read-only. Gender supports MALE/FEMALE/OTHER/UNDISCLOSED. Removing gender/date uses `clearGender`/`clearDateOfBirth`, rather than null (which means keep the current value). Date validation follows Vietnam's current date, including leap days.
- Contact email defaults to login email. Request and verify an OTP before activating a different address; reset returns to the login default.
- Declare/change a personal bank with a review-and-confirm step. Consolidated `GET /api/account/profile` can return a plaintext account number: every profile API wrapper strips it **before** entering query data, including update/OTP/reset responses. An explicit audited GET shows the number only in component state, cleared after 60 seconds, hiding, logout or identity switch. Late reveal responses after hiding are ignored. `NEEDS_UPDATE` offers correction rather than an unusable reveal action. Personal bank is separate from shop withdrawal details.
- Drafts survive background refresh for the same identity, but are reset when the signed-in account changes.
- Cancel restores the last saved basic profile. Profile and bank writes cannot overlap.
- OTP expiry and resend cooldown follow backend durations and absolute deadlines; resending clears the previous code. Expired codes cannot be submitted. Email failures are reported as failures, never presented as delivery success.
- Customer/Seller can change passwords and link the matching Google identity. Other roles see support guidance and never call member-only password/Google endpoints. Changing a password revokes sessions and redirects to sign-in.
- The compact profile has a sticky section index with scroll position tracking, two basic-form columns on desktop and one on mobile, shorter guidance and per-field password visibility. Drafts in basic/bank/password/contact forms warn before following away links or logging out; native beforeunload protects reload/closing. Confirming an internal section anchor does not discard the form. No drafts or passwords are persisted to browser storage.

API responses use generated contracts from backend OpenAPI (`pnpm contracts`); do not hand-edit generated files. Portal tests in `tests/portal/personal-profile.spec.ts` use mock network responses and never deliver real emails. Run them with the portal Playwright configuration; actual delivery requires a manual inbox check against the local backend.

## API coverage, checked 2026-10-29

| Operation                     | Endpoint                                 | FE behavior                                                                |
| ----------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| Read/save personal profile    | GET / PUT `/api/account/profile`         | Six human roles; basic information, demographics and personal bank         |
| Reveal personal bank          | GET `/api/account/profile`               | Explicit audited read; raw number outside query cache                      |
| Send / resend contact OTP     | POST `/api/account/contact-email`        | Email entry, sending/error state, server cooldown                          |
| Verify contact OTP            | POST `/api/account/contact-email/verify` | Six-digit code, expiry, invalid-code handling                              |
| Restore default contact email | POST `/api/account/contact-email/reset`  | Return to login email                                                      |
| Change member password        | POST `/api/member/password`              | Customer/Seller only; backend password requirements and session revocation |
| Link Google                   | POST `/api/member/google/link`           | Customer/Seller only; existing Google Identity Services integration        |
| Provider availability         | GET `/api/auth/config`                   | Existing Google configuration and disabled-provider handling               |

The legacy `/api/account/profile/bank/reveal` POST still appears in Swagger; this page uses the consolidated GET instead. No backend source or generated contracts were edited.

## Verification and remaining backend coordination

- Live HTTP verification through FE `localhost:8088` to BE `127.0.0.1:5080`: 21 assertions passed on the existing disposable local Customer account. Included persisted demographics, clear flags, invalid future date, fictional bank create/read/clear, invalid OTP rejection, contact reset, password change/revoked session/re-login. Original profile, bank absence and password restored afterward. Results are in ignored `artifacts/profile-completion/live-api-results.json` (no credentials or bank number in the report).
- Unit/browser suites cover contract normalization, removal of plaintext bank data, all six role views, errors, drafts, OTP success/expiry/resend, delayed reveal, Google integration fixtures and 320/390/1440px accessibility. These are separate from live HTTP evidence.
- Deployed Swagger `https://api.florabot.site/openapi/v1.json` contains all listed paths and demographic fields. Public deployed auth configuration enables Google/email; local config disables both. Checking Swagger/config does not verify deployed authenticated writes, inbox delivery or an actual Google OAuth exchange.
- Local OTP delivery is blocked by the disabled email provider (503). Team BE needs to provide local email configuration or a designated deployed test environment/inbox for an end-to-end delivery check.
- BE currently permits self-service password changes only for Customer/Seller. If Admin, Operations Manager, Technician or Seller Staff must change their own passwords here, BE needs an authorized self-service endpoint/policy for those roles. FE does not call the forbidden member endpoint for them.
- No API for profile-photo upload or login-email changes is exposed for this page; avatar initials and read-only login identity remain the supported behavior.
