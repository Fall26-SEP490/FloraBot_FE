# FloraBot FE

Independent pnpm workspace for the Astro landing, shared UI and generated API contracts. The portal and kiosk applications are still being implemented; see the workspace REQUIREMENTS.md.

## Run

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Landing: http://localhost:4321. API requests during development proxy to http://localhost:5080. Start BE separately. Set SITE_URL to the real deployment domain before release; the default florabot.example is deliberately non-production.

## Kiosk

`pnpm dev:kiosk` runs the kiosk at http://127.0.0.1:5174 with its development API proxy to port 5080. Staff enter the kiosk UUID and provisioned device key on first use; the key is kept only in that tab's sessionStorage, never bundled into JavaScript. Use this on a managed kiosk browser, not a shared public website. Closing the tab requires setup again.

The current guest flow lists available bouquets from `/catalog/items`, creates a checkout, displays a QR code opening the payOS page, and polls order/receipt state. The QR opens payOS with a phone camera; it is not a raw bank-app VietQR payload. Checkout creation is never automatically retried. Ending a visit or ten minutes of inactivity clears the cart/receipt; the server independently expires holds. A one-minute inactivity warning precedes the reset.

`pnpm test:kiosk` builds and tests the production PWA. Its service worker caches static shell assets only, with no API caching or background purchase sync. Offline purchase actions are disabled. Production hosting must route `/api` to BE on the same origin. Loyalty/AI and receipt dispute screens are not yet implemented in this app. Tests use mocked HTTP; real kiosk hardware and gateway verification remain required.

Customers may optionally request a three-minute SMS code and authenticate before checkout. The access token stays in React memory only; checkout uses that bearer token instead of the device key. The session ends at its server-provided expiry (capped at ten minutes), on 401, explicit end-of-visit, or idle reset. There is no customer refresh. Backend SMS delivery requires HTTPS `SMS_WEBHOOK_URL` and `SMS_API_TOKEN`; unavailable SMS does not block guest purchases. Tests use a fake SMS transport and never send an actual message.

## Check

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:a11y
```

With the preview server running on 127.0.0.1:4321:

```powershell
pnpm exec pa11y-ci --config .pa11yci.cjs
pnpm audit:browser-zoom
pnpm exec lhci autorun --config=lighthouserc.cjs
```

Screenshots: `.impeccable/review/landing-{390,820,1440}.png`. Lighthouse reports: `artifacts/lighthouse`. The fast landing/portal tests mock HTTP for focused client checks. The separate integration suite below uses actual API/database traffic.

`audit:browser-zoom` uses a disposable Chromium profile and local test extension to
set native browser zoom to 200% on landing/privacy. It verifies actual zoom metrics,
expanded content reflow and form error focus, writes `artifacts/browser-zoom.json`
and viewport screenshots, then removes the temporary profile. It does not install
anything in the user's browser. This is separate from CSS text-resize tests and
does not certify manual NVDA/Firefox accessibility.

Landing acceptance findings are in `docs/landing-audit.md`. The dated audit recorded:
pa11y/axe pass, Lighthouse performance 99 and accessibility 100. After merging the
Latin/Vietnamese font files without removing glyphs, LCP is 1800.73 ms and passes
the explicit 2-second local lab gate. `pnpm audit:landing-js` measures the actual
production build: after the shared flower-library/Zod Mini update, initial JS is
4139 bytes and fully interactive JS is 473882 decoded bytes.
As requested on 2026-10-08, size is informational: the 100 kB threshold no longer
fails CI. Build-hash and measurement-integrity checks remain enforced. Do not use
this measurement as proof of complete WCAG acceptance.

Shared photography: `@florabot/ui/flower-photos` provides 12 distinct flower photos
with AVIF/WebP responsive sources and Vietnamese descriptions. Source files,
provenance and usage instructions are in `packages/ui/assets/flowers/`. Landing
uses three ribbon photos, eight collection photos and one registration photo,
plus matching gift-demo images. Other FE apps can import the same library.

### Browser-to-API integration

Keep FE and BE as sibling directories. With .NET 10, PowerShell 7, Docker and the usual FE
dependencies installed, start BE's PostgreSQL and Valkey containers, then run `pnpm test:integration`
from FE. This command recreates **only florabot_browser_tests**, seeds it and applies runtime
migrations. Do not use that database for data you need to keep.

The suite starts isolated servers on ports 4331 (landing), 5183 (portal), 5082 (YARP) and 5081 (API), and
stops them afterward. These ports must be free; existing application servers are never reused.
It exercises registration, CLI provisioning, admin login/approval, seller login/route guards,
tenant denial and subscription creation through actual browser HTTP, PostgreSQL and Valkey.
payOS credentials are deliberately empty: payment-link unavailability must not activate the shop.
There are no browser request mocks. Generated passwords stay in process memory/stdin; auth
traces/video are disabled. The suite does not change application account passwords.

`.github/workflows/browser-integration.yml` runs this cross-repository check on manual dispatch
with the matching BE commit SHA. Both revisions must already be available on GitHub; private
companion repositories also require the COMPANION_REPO_TOKEN secret with read access. This workflow has not
been run remotely. Actual payOS payment, MQTT doors and settlement remain separate integration work.

The 3D cabinet is a labelled conceptual model. Flower photos are illustrative, not live inventory. See `docs/assets.md`. No actual hardware photograph, seller testimonial or operational sales claim is fabricated.

API types are generated with `pnpm contracts` from the backend-exported OpenAPI file. Runtime form validation lives next to the generated contracts. Never hand-edit generated types.

## Portal authentication

Run `pnpm dev:portal` on http://127.0.0.1:5173 with BE on port 5080.
The portal uses HttpOnly session cookies, one shared refresh request, server-checked role guards,
and a persistent seller subscription status notice. Its account overview shows real session data.
Seed SQL passwords are deliberately invalid; use BE's documented one-time provision-user command.
Fast browser tests use intercepted auth responses; `pnpm test:integration` verifies actual login and cookie behavior.
Run `pnpm test:portal` for login, logout, expired refresh, role routing and axe checks at 390/1440.
Production requires explicit origins, HTTPS and proper frontend routing; do not publish the Vite dev server.

The seller page includes product search/edit, subscription registration/payment links and stock entry by batch. Admins can approve shops and assign slots. DTOs come from backend OpenAPI, and SQL enforces eligibility and ownership. Wallet, returns and remaining administrative workflows are still being implemented.

## Kiosk gift advisor

Open the optional "Cần một chút gợi ý để chọn hoa?" section on the shopping screen.
Five labelled fields collect recipient, age group, occasion, message tone and budget.
The form uses generated AiSuggestRequest/GiftSurveyResponse contracts and real
POST ai_suggest followed by an owner-scoped survey GET. Retrying a failed read
reuses its survey UUID; answers stay visible after an error. No automatic POST retry.

Suggestions can add a currently available bouquet to the existing basket. They
do not reserve stock or change prices. Unavailable/offline selections are disabled;
checkout remains authoritative. Rule-based fallback is labelled honestly. Customer
requests use the current short-lived Bearer token; signing in resets guest survey
UI and ending the visit clears the survey with the rest of the kiosk session.

pnpm test:kiosk covers survey validation, result focus, axe/reflow at 390/1024,
selection, failed read retry, offline, stale/empty results and customer authentication.
These tests intercept HTTP; pnpm test:stack additionally exercises the deployed
kiosk survey through Caddy, YARP and PostgreSQL without browser mocks.

### Portal live updates

The authenticated workspace connects to `/hub/portal` using HttpOnly session cookies.
Server Refresh messages invalidate API queries; reconnect also reloads current data.
Visible online pages refetch every 30 seconds as a fallback and retry a disconnected hub.
These refetches preserve filters, mounted forms and keyboard focus. Logout disposes the
connection, event listeners and timers. Vite forwards `/hub` WebSocket traffic to YARP.

`pnpm test:portal` covers reconnect, polling fallback and logout cleanup with controlled
transports. `pnpm test:integration` verifies actual registration-to-admin refresh through
YARP, SignalR and PostgreSQL using a disposable database. Job/payment/device notifications
are not yet fully connected; this best-effort mechanism does not replace CAP outbox delivery.

### Seller wallet

The seller workspace reads typed `/sellers/{sellerId}/wallet` data: ledger-derived balances,
recent movements, withdrawal progress and the configured minimum. An inline review confirms the
amount before calling the existing `request_withdrawal` flow. A lost response blocks resubmission
until history is reviewed, including across a tab reload; only an uncertainty flag is stored.
Pending requests do not reduce available funds in the source flow. This safeguard is not a
server-side idempotency guarantee.

`pnpm test:portal` covers validation, confirmation, lost response/reload, missing bank information,
read errors and accessibility at 390/1440. The registration integration test additionally requests
a withdrawal through actual HTTP and PostgreSQL using a balanced disposable fixture. Administrator
payout screens remain outstanding; no real transfer is performed by these tests.

The wallet's “Tài khoản nhận tiền” disclosure supports bank/holder/account entry, review and update.
It reads only masked account details and clears raw form values after success/cancel. The raw account
is not stored in browser storage or TanStack mutation/query cache. Prior withdrawal requests retain
their original bank snapshot. Input validation is not verification of bank ownership. Browser tests
cover errors, focus, leading zeros, masking and clearing; the actual integration test saves through
the protected backend flow before requesting withdrawal.

### Seller device-fault reports

Each rented slot exposes a report form with a description, HTTPS evidence-photo link and an
inline review that explains the source flow's effects on selling, checkout and refund obligations.
It calls `report_device_fault`; kiosk/slot IDs come from the selected slot, and the backend supplies
the authenticated reporter. Reports are available even when a sales subscription is not active.
FAULT/LOCKED slots direct the shop to the operations team instead of inviting duplicate reports.

An uncertain response blocks another report in the same tab across reload until the shop explicitly
confirms reconciliation with the team. Only a boolean marker scoped to seller and slot is stored;
this is not server-side idempotency. Business errors preserve the entered text. Successful reports
refresh inventory. Photo links are not uploaded, downloaded or verified by this form; verified media
storage remains outstanding. Existing SQL is authoritative for open-door rejection and paid-order
refund effects. The integration test uses a disposable empty-slot fixture and a synthetic photo URL;
it verifies the stored reporter, FAULT transition and foreign-slot denial without actuating hardware.

### Administrator incident review

The admin workspace lists open or resolved technical incidents, 25 per page. Details load when
opened and show the report, location, HTTPS evidence links and resolution note. Unsafe links are
not clickable and remote images are never loaded automatically. Evidence truncation is explicit.
The repair note is reviewed before the existing resolve_device_fault command; backend refund
guards remain authoritative. Errors preserve the note; unknown outcomes refresh the state and
do not claim success. Live pagination can shift while other administrators work; refresh resets
to the first page. Browser integration now completes shop report -> admin review -> resolution
through gateway/API/PostgreSQL using a disposable fixture, without a physical repair claim.

### Administrator withdrawal workspace

The admin workspace supports paged withdrawal review, approval, rejection and recording an
already completed manual transfer with a proof URL. A separate active admin must perform the
payout step. Bank details are masked until explicit audited access to the request's saved
destination. Full account data is held only in component state, not TanStack cache or storage,
and clears after one minute, on page hiding, or when the detail closes. Recording a transfer
requires review and an explicit confirmation that staff already transferred and reconciled it.
Unknown responses do not claim success and instruct staff not to transfer twice. The application
does not atomically perform or reserve external bank transfers. Proof upload/verification and
refund/reconciliation screens remain incomplete. Integration tests only record a synthetic payout
against the disposable browser database, with two separately provisioned admin accounts.

## Public receipts

Open `/receipt` on the integrated origin (local Docker: `http://localhost:8088/receipt`). A kiosk QR fills the order UUID and eight-character tracking token using a URL fragment. The page clears that fragment and keeps entered data only in memory; reloading requires the original QR or both codes. Lookup does not require portal login and sends no portal cookies. Use `VITE_RECEIPT_URL` when the kiosk needs a different receipt origin (for example a LAN address reachable by a phone).

Current delivery: receipt lookup, order items, complaint deadline, pending/paid refund amounts, refund-account submission, complaint entry, admin decisions and manual refund recording. Verified image/proof upload and provider reconciliation remain pending. See BE ADRs 0029-0033.

Receipt refund accounts: when a pending refund exists, `/receipt` allows bank/account/holder entry, review and explicit submission. Raw values stay out of browser storage and query caches. A successful submission means the account was saved, not that a transfer occurred. Response loss clears inputs and requests a fresh lookup. The bank account is encrypted by the API; source SQL removes it after the final pending refund is paid. See BE ADR 0030.

Portal test reliability: loaded admin actions stay available while background reads refresh their data; pending writes stay locked and server flows recheck permission/state. `incidents.spec.ts` and `payouts.spec.ts` include pointerdown/refresh/pointerup regression cases. Portal and integration suites write to separate `test-results/portal` and `test-results/integration` directories. Keep database-heavy backend and browser integration suites sequential to avoid exhausting the local PostgreSQL connection limit.

Receipt complaints: customers with an eligible completed order can open the complaint form, enter a description and HTTPS evidence link, review, and confirm. The API enforces the server-time window and one complaint per order. A lost response requires checking the receipt before another attempt. The current UI accepts an evidence link; direct uploads and image-byte/hash verification remain pending. Sending a complaint does not approve a refund. See BE ADR 0031.

Admin complaints: `/admin` includes a paginated queue and evidence/order detail, with separate filters for pending, approved-refund and rejected decisions. Enter an amount (0 to reject), a reason, then review and confirm. This calls `resolve_dispute`; approved refunds remain pending payment by another admin. Unknown responses require an explicit detail reload before retry. The UI does not initiate transfers or verify evidence bytes. See BE ADR 0032.

Admin refunds: the refund queue allows human approval of automatic refunds, audited bank access by a different admin, and recording a completed manual transfer with a proof URL and explicit confirmation. Bank values stay outside query/mutation caches and browser storage; they hide after a minute, page hiding or closing detail. Late reveal responses after hiding are discarded. A customer can update the order's destination while a refund remains pending, so the shown destination is a current snapshot, not a transfer reservation. Coordinate transfers outside the app to avoid duplicate bank payments. Source SQL clears the bank fields after the last refund is paid. Proof-byte verification and provider reconciliation remain unfinished. See BE ADR 0033.

Admin reconciliation: choose a Vietnam calendar date for the daily report, or paste up to 5,000
PAYOS statement rows as `[{"txn":"provider-id","amount":100000}]`. Review the date, unique ID
count and total before explicitly submitting. Duplicates are summed; unrelated input fields
are not sent to the API. An empty array means the statement has no incoming payments.
The browser requires safe integer amounts and duplicate totals. Differences show 20 per page.
Daily reports distinguish VND from refund counts and current all-time balances from dated rows.
Data stays in component state, is cleared on tab hiding or explicit clear, and late responses
cannot repopulate it. There are no automatic retries, payment creations or bank transfers.
Manual statements are not verified provider feeds. See BE ADR 0034; `admin-reconciliation.spec.ts`
and the real receipt integration cover the UI/API/SQL behavior.

Customer privacy on kiosk: after OTP login and before checkout, open “Lịch sử mua và thông tin cá nhân”.
History and points load on request, 25 orders per page. Closing the account screen discards its data;
tab hiding ends the private session. History and token never enter persistent browser storage.
Erasure requires reading the retention explanation, checking acknowledgement and confirming.
Success or an uncertain write outcome ends the session and clears customer/query state; requests
are not retried automatically. Historical transactions and pending-refund destinations follow the
source SQL retention rules rather than being represented as universally deleted.

`customer-account.spec.ts` covers keyboard focus, responsive axe, pagination, offline/read errors,
expired sessions, response loss and late responses. `customer-privacy.spec.ts` uses real gateway,
API, Valkey OTP and PostgreSQL with a synthetic customer. The test stack enables Development-only
OTP delivery; it does not send SMS. Kiosk dev proxy accepts `API_PROXY_TARGET` for that isolated
gateway. Kiosk, portal and integration suites have separate test-results directories.

### Kiosk loyalty redemption

Signed-in customers can explicitly read their points and the current redemption percentage,
then enter an integer amount in the basket. The cap applies to the largest seller order;
checkout revalidates live balance and pricing. Receipts show the server-confirmed discount.
Points stay in component memory, are discarded at visit end, and late reads cannot restore
a hidden/closed session. Confirmed 400/409 checkout rejections allow manual correction;
an uncertain network/server outcome still blocks resubmission.

`tests/kiosk/loyalty.spec.ts` covers input, rejection/retry, unsafe integers, response loss,
session expiry, hidden-tab races and desktop/mobile axe. `tests/integration/loyalty.spec.ts`
uses real OTP/gateway/API/PostgreSQL to verify the discounted order and payment records;
it does not initiate an external payment or dispense physical flowers.

### Optional gift message

The basket accepts an optional 150-code-point message through existing `p_ecard`.
Customers can explicitly use an advisor message, edit it and keep their wording when
choosing flowers. The UI counts Unicode like PostgreSQL, preserves line breaks and
clears the draft on successful checkout, visit reset, account-screen entry or tab hiding.
No message is stored in browser storage. The message is saved with each seller order;
printing and separate recipient delivery are not supported. See BE ADR 0037.

### Pickup recovery

The kiosk's “Đã thanh toán nhưng chưa nhận hoa?” action opens a dedicated receipt-ID
and receipt-token form with explicit review before `request_pickup`. HTTP 200 with a
null result is a rejected code, not acceptance. An accepted request is not presented as
proof that a door opened. Network/server uncertainty never automatically resends a command.
Inputs stay in component memory and are cleared on back/reset/hiding. Customer login is
not required; the current kiosk key and receipt capability authorize the original flow.
See BE ADR 0038 and `tests/kiosk/pickup.spec.ts` for coverage and hardware limits.

### Kiosk accessories

Customers can explicitly load available accessories and choose quantities for a mixed
or accessory-only basket. The public catalog refreshes while shopping. Stock bounds,
integer quantities and safe monetary values gate checkout; unavailable selections can
be cleared. A failed optional catalog does not prevent buying only flowers.
Requests send only accessory IDs/quantities; the server sets actual prices and stock.
`tests/kiosk/accessories.spec.ts` covers responsive axe, quantity errors, cart payloads,
stale inventory and unsafe prices. The real mixed-basket integration also verifies
stored accessory quantities, points, messages and pickup recovery. See BE ADR 0039.

### Seller accessory inventory

The seller portal loads inventory on demand, including inactive and empty accessories.
Each row identifies its kiosk and supports review/confirmation of a positive restock quantity.
Unknown network/server outcomes block resubmission in the current form; operators must
reconcile inventory and audit history before another attempt, including after reopening the page.
This is not server-side idempotency. Restocking does not change sale state or open doors.
See `tests/portal/accessories.spec.ts` and BE ADR 0040.

### Product photos

Each product editor includes an explicit gallery load, 20-image paging, local file
preview and a raw PNG/JPEG/WebP upload (up to 5 MiB). A successful upload refreshes
the first gallery page. Expired shops can inspect images but cannot upload.
Ambiguous network/server results disable the current upload form: read the gallery
and contact operations before another attempt. This is not durable server idempotency.
Images are public product photos; private evidence must use a separate storage flow.
`tests/portal/product-photos.spec.ts` covers payloads, preview, invalid files/URLs,
lost responses, pagination, read failures and desktop/mobile axe/reflow. Provider
credentials/live Cloudinary verification remain external setup; see BE ADRs 0041/0042.
