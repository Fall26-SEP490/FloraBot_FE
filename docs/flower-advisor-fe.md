# Flower advisor FE handoff

The advisor and hotline are mounted once in the root `SiteFrame`, on every page
for guests and signed-in roles, including authentication and workspace pages.
The shared session query selects seller prompts for `SELLER`; everyone else uses
the customer prompts. Chat survives client-side navigation and resets when the
account identity or role changes. Mobile chat/product pages raise both floating
buttons above the bottom composer or action bar.
The support dock stacks two 50px green circular icons, hotline above advisor with
a 12px gap. Desktop labels sit to the left on white pills; mobile hides the phone
number and keeps the compact advisor label. The default hotline is `0355 357 665`
(`tel:0355357665`); `NEXT_PUBLIC_SUPPORT_PHONE` can override it.
It calls `POST /api/shop/flower-chat` using the shared request helper, including
cookies and the existing single-flight session refresh. No backend changes.

## Behavior

- The customer has quick questions for nearby kiosks, top preorder shops and
  preorder suggestions. Seller has its own catalog questions and no customer
  location/kiosk controls.
- Location permission is requested only on a click. Coordinates stay in memory;
  removing the location stops including them in subsequent requests and retries.
  Successful positioning immediately asks for the nearest preorder kiosk using
  the newly obtained coordinate pair, without discarding a different draft. A
  visible active state and status confirm success; denied/insecure/unsupported
  positioning remains recoverable through manual kiosk selection.
- The kiosk selector is for walk-in. The explicit walk-in action and typed
  purchase wording send `WALK_IN`. Preorder questions send `PREORDER`, optional
  coordinates and no walk-in kiosk restriction. Budget interpretation for typed
  questions remains on the API.
- `message` is always shown. Empty suggestions are a valid text answer.
  `UNAVAILABLE`, including HTTP 200, and network failures have a retry action.
  Retry replaces the failed turn instead of adding a duplicate. A new draft is
  preserved while another question is pending.
- Cards use a compact 88px square thumbnail beside the name and price, preserving
  the full API photo with `object-fit: contain`. Missing/broken photos use a
  labelled neutral placeholder. The reason, shop and kiosk remain visible below;
  product and shop reviews stay separate and appear only when rated. Preorders
  label the price as a sample price. One green action opens the API destination.
- At most ten turns are retained in page memory. The API receives one question,
  not a conversation history. The composer permits
  500 characters. Concurrent sends are blocked.
- Shared modal handles Escape, focus trapping, focus return and body scroll
  locking. Chat scrolls separately from the composer. Mobile uses the visual
  viewport to retain the composer when the available height changes. The
  floating launcher sits below the support hotline.
- The reference-inspired chat uses the FloraBot forest-green header, unchanged
  customer/seller quick questions, right-aligned customer bubbles and soft
  assistant bubbles. Location and kiosk selection use a compact toolbar. The kiosk
  picker replaces the transcript temporarily with searchable names/codes/addresses;
  selection, Back and Escape return to the same draft and transcript position.
  Desktop supports expanding the taller panel; mobile retains the full viewport.
  The footer links to the existing privacy policy without adding a consent gate.
- Entry/exit animate the panel and dimmer independently. Exit retains the focus
  trap and scroll lock until animation completion, with a bounded fallback.
  Expanding uses FLIP (one layout read per size, transform-only animation);
  kiosk selection and new replies have short entrance effects. Reduced motion
  disables these effects and closes immediately. No motion dependency was added.

## Verification

`tests/portal/flower-advisor.spec.ts` covers guest authentication/receipt pages,
all workspace roles, singleton mounting and drafts across navigation, position
opt-in/removal/denial, text-only/off-topic answers, preorder/walk-in destinations,
missing images/ratings, kiosk reload, retry, in-flight duplicate prevention,
seller session refresh, history bounds, accessibility and layout at 375/1440px.
The short-height case simulates reduced available space; it is not a substitute
for checking the virtual keyboard on an actual iPhone/Android device.

These browser tests intercept the API. Final acceptance against production v47
should check actual nearby-kiosk data, live recommendations and real devices.
