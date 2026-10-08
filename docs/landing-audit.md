# Landing acceptance audit - 2026-10-08

## User decision: JavaScript size is informational

On 2026-10-08 the user explicitly removed the mandatory 100kB JavaScript limit.
The audit still measures initial and complete interactive transfer/decoded sizes,
checks that served HTML matches the production build and fails on missing evidence.
Only the size-based failure was removed; CI labels this measurement informational.
Earlier budget-blocker statements below are historical and superseded by this decision.
LCP, CLS, accessibility and functional checks remain in force.

## Current technical audit after token consolidation

Current scoped score: **16/20**. This supersedes the dated 13/20 baseline below;
it is not full WCAG certification, mentor approval or completion of E7.

| Dimension                | Score | Evidence and remaining limit                                                                                                                                                                                                     |
| ------------------------ | ----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility            |   3/4 | All 18 landing browser checks pass, including axe, keyboard disclosures and form errors; pa11y reports zero errors on both pages. Manual NVDA/Firefox is still unverified.                                                       |
| Performance              |   3/4 | Latest measured LCP 1800.73ms, CLS 0.0000331, Lighthouse performance 99; responsive images and merged Vietnamese fonts reduce transfer. Complete interactive JS still exceeds 100kB; budget interpretation remains pending.      |
| Responsive               |   4/4 | 390/820/1440 checks, 320px reflow, text spacing, 200% text sizing and previous native 200% Chromium zoom evidence cover the supported layout. Attribution/privacy targets were corrected. No physical-device testing is claimed. |
| Theming                  |   3/4 | Repeated pale surfaces, dividers, action hover and inverse text now use shared semantic tokens. Remaining local colors are limited map/decorative treatments. Dark mode is outside the requested brief.                          |
| Implementation integrity |   3/4 | Source detector has no findings; product-specific Vietnamese content and flower assets remain. Older direction documentation still needs an explicitly scoped refresh.                                                           |

The token-only update changes packages/ui/src/tokens.css and
apps/landing/src/styles/landing.css. A replacement roundtrip verified that the
landing rules recover their exact original values; white canvas and inverse
tokens resolve to the original white. Layout, copy and behavior are unchanged.
Token roles are documented in packages/ui/README.md, including the distinction
between decorative dividers and contrast-bearing input boundaries.

Validation: artifacts/token-build.log (pass), token-browser.log (18 passed),
token-pa11y.log (2 URLs, zero errors), token-detector.json (empty findings).
Performance and native zoom numbers above refer to the preceding merged-font
snapshot, not new measurements after this equivalent-color substitution.

Open findings: P1 complete interactive JS budget; P2 stale direction document;
manual screen-reader/focus verification remains unverified. The repeated-palette
portion of the previous token finding is addressed; isolated local map and
decorative colors remain. No backend, original SQL, framework or dependency change.

## Merged Latin/Vietnamese fonts: LCP gate passes

Be Vietnam Pro 400/600/800 previously required separate Latin/Vietnamese font
requests. `tools/merge-landing-fonts.py` combines each matching pair and verifies
the complete union of 325 codepoints, decomposed glyph outlines, horizontal widths
and vertical metrics against both installed sources. No characters are removed;
font families, weights and swap behavior remain. WOFF2/WOFF plus SIL OFL license
are stored under src/assets/fonts; normal builds need no additional dependency.

On the same Lighthouse mobile simulation/configuration, the prior responsive-image
snapshot recorded LCP 2177.0295ms; the merged-font snapshot records **1800.73ms**,
meeting the unchanged 2000ms gate. Performance remains 99, accessibility 100 and
CLS 0.0000331. Initial font requests drop from seven to four; transferred font
bytes drop from 120392 to 92704 (27688 bytes fewer). This is a local lab result,
not a claim for all devices, production traffic or all of E7.

Reports: artifacts/lighthouse/127_0_0_1--2026_10_08_03_01_09.report.json and
127_0_0_1--2026_10_08_03_21_48.report.json; artifacts/merged-font-lighthouse.log.
Build, scoped lint, landing typecheck, all 18 landing browser cases and the native
200% browser-zoom audit passed. The 390/820/1440 hero captures and all four font
family/weight Vietnamese samples were visually inspected in
.impeccable/review/merged-font-{390,820,1440,vietnamese}.png.

The local web container was rebuilt and all five deployed-stack checks passed
(BE/artifacts/merged-font-docker.log, artifacts/merged-font-stack.log).

The JS budget remains unresolved, separate from this LCP result. The user has been
asked whether its 100kB limit means initial-load, complete transferred or complete
decoded bytes; no threshold or framework has been changed pending clarification.
Manual NVDA/Firefox and other acceptance work remain outstanding.

## Native browser zoom at 200 percent

`pnpm audit:browser-zoom` now verifies `/` and `/chinh-sach-rieng-tu` in a fresh
Chromium profile using `chrome.tabs.setZoom/getZoom`, not CSS resizing or pinch
zoom. The temporary local extension/profile is removed afterward; the user's
browser settings and existing tabs are untouched. The preview HTML must match
the current production build hash before the check proceeds.

At a 1440px outer window, the measured content viewport changes from 1424 to 712
CSS pixels and devicePixelRatio from 1 to 2. Root font size remains 18px and visual
viewport scale remains 1. After opening the map and disclosures, running the gift
demo and exposing registration errors, both pages retain scrollWidth 712 and no
detected clipped headings, paragraphs, labels, inputs, selects, buttons or summaries.
The registration error focuses the shop-name field. The clipping scan excludes
intentional map internals and the honeypot; map accessibility retains separate tests.

Evidence: artifacts/browser-zoom.json, browser-zoom-final.log, browser-zoom-lint-final.log;
viewport captures `.impeccable/review/browser-zoom-200-{landing,privacy}-{top,content}.png`
were visually inspected. Direct viewport capture avoids Playwright's full-page
CSS-pixel clipping at native browser zoom. Initial script failures concerned lazy
hydration, a changing details selector and an ambiguous header selector; these were
corrected without modifying the application. Scoped lint passed after importing
Buffer explicitly and validating the temporary path before cleanup.

The check is included in FE CI and uploads its JSON evidence. Remote execution is
not claimed. This provides actual Chromium browser-zoom evidence at this window
size; it does not replace NVDA/Firefox, other manual WCAG checks or performance gates.

## Responsive cabinet image follow-up

The existing hero cabinet displayed at 161px on a 390px viewport but downloaded
the 1000px AVIF (24187 bytes). It now has 240/480/720px AVIF/WebP candidates, with
the original 1000px formats and PNG fallback retained. The offline generation
script is tools/resize-kiosk-images.mjs. Layout, flower imagery, text, fonts and
interaction behavior are unchanged.

Cold production-preview resource checks (matching served HTML to the build hash)
recorded 5282 bytes at 390px/1x and 10668 bytes at 390px/2.625x, 820px/1x and
1440px/1x. The high-density check prompted a sizes correction for image padding;
otherwise the 390px/2.625x browser unnecessarily selected the 720px candidate.
See artifacts/responsive-hero-resources.json. Desktop/tablet/mobile hero captures
were inspected in .impeccable/review/responsive-hero-final-{390,820,1440}.png.

Lighthouse baseline LCP 2178.4395ms; final LCP 2177.0295ms. This is effectively
unchanged and **still fails 2000ms**. Final performance 99, accessibility 100,
CLS 0.0000331. Reports: artifacts/lighthouse/127_0_0_1--2026_10_08_02_55_23.report.json
and 127_0_0_1--2026_10_08_03_01_09.report.json. No gate was relaxed. This image
improvement saves transfer bytes; it does not close E7 or alter the JS budget.

Build, landing typecheck and scoped lint passed. All 18 landing browser tests
passed before the final sizes-only correction; final cold resource checks cover
that correction. Logs: artifacts/responsive-hero-{build-final,typecheck,lint,browser}.log.
An initial Astro Picture build failed to resolve Sharp; static offline derivatives
avoid that build-time resolution issue. Additional critical-font preloads were
measured, showed no material LCP benefit, and were removed. Failed and intermediate
Lighthouse reports remain available; no successful overall performance verdict.

Local web Docker rebuild passed; all five deployed-stack checks passed afterward
(BE/artifacts/responsive-hero-docker.log and artifacts/responsive-hero-stack.log).

## Keyboard and target-size follow-up

An expanded 390px page inspection found three links below the brief's stricter
44px target requirement: Leaflet/OpenStreetMap attribution links (15px high) and
the registration privacy link (42.484px high). Inline-link exceptions in WCAG
mean this finding alone is not a claimed WCAG AA violation.

These links now have at least 44px targets. Map attribution has an opaque white
background and sits at top right, preserving source credit and leaving the initial
Hoang Sa/Truong Sa labels clear. The first visual check caught the enlarged bottom
attribution overlapping the Truong Sa label; the top-right correction was confirmed
at 390/1440 in .impeccable/review/map-targets-final-{390,1440}.png.

tests/browser/landing-keyboard.spec.ts opens optional disclosures, hydrates the
controls, checks visible enabled targets, and traverses all controls in both Tab
directions on the landing/privacy routes. It checks focus outline styling and a
visible portion of each focused target with a center-point occlusion check. A
large map need not fit entirely in the viewport. This is programmatic browser
evidence, not a human screen-reader session or proof of all focus-ring pixels.

All 18 landing cases, landing typecheck and scoped lint passed. Logs:
artifacts/landing-keyboard-regression-final.log, landing-keyboard-typecheck-final.log
and landing-keyboard-lint-final.log. Initial test setup was corrected to scroll
the lazy gift island into view before expecting it to be enabled. Manual NVDA,
actual browser zoom and the performance gates remain outstanding.

## Latest font-loading follow-up

The landing now imports only Latin/Vietnamese font faces, preserving Fontsource's
unicode ranges, existing families/weights and font-display swap. Headline Be Vietnam
Pro 800 gets preload priority instead of the Nunito wordmark. Both index.astro and
landing.css hashes stayed unchanged across this before/after comparison.

Lighthouse before: LCP 2625.3885 ms, performance 96, accessibility 100, 11 font
requests / 168310 transferred font bytes. After: LCP 2178.513 ms, performance 99,
accessibility 100, CLS 0.0000331, 7 font requests / 120392 transferred font bytes.
LCP still fails the 2000 ms gate. No threshold was relaxed or run repeated to select
a passing value. The transfer count reflects that measured initial viewport, not
all possible text on the page.

Evidence: artifacts/font-{baseline,subsets}-lighthouse.log; raw reports
artifacts/lighthouse/127_0_0_1--2026_10_08_02_27_04.report.json and
artifacts/lighthouse/127_0_0_1--2026_10_08_02_28_08.report.json.
All 16 landing browser cases, landing typecheck and scoped lint passed. A rendered
Vietnamese sample was inspected for all four family/weight combinations at
.impeccable/review/font-subsets-vietnamese.png. This is glyph/visual evidence, not
a manual NVDA or complete WCAG pass. JavaScript acceptance remains unresolved.

## Performance follow-up after cross-session changes

The user confirmed keeping the other session's landing edits. The JS audit now
opens the consent-based map, expands the gift tool, submits its demonstration and
hydrates registration before recording interactive payload. The old selectors
could no longer measure that journey. The served-build hash check remains intact.

On this measured build, switching Leaflet's default CommonJS entry to its shipped
ES module and selecting only used exports reduced interactive decoded JS from
477546 to 473882 bytes (3664 bytes), with initial JS unchanged at 4139 bytes at
390/820/1440. This is a small reduction, not acceptance of the 100 kB whole-page
budget. Logs: artifacts/leaflet-baseline-js.log and artifacts/leaflet-esm-js.log.
The command still gates initial JS only; interactive failure is retained in JSON.

All 16 current landing browser cases, landing typecheck and scoped ESLint passed.
The map retained OSM tiles, bounds and both Vietnamese archipelago labels;
desktop/mobile screenshots were inspected. No dependency version, map consent,
font or business-copy change was made by this optimization.

Lighthouse on this build returned exit 1: LCP 2629.41 ms, above 2000 ms. The LCP
element was the hero garden image, with render delay reported as 2178.528 ms.
See artifacts/landing-current-performance.log and
artifacts/lighthouse/127_0_0_1--2026_10_08_02_24_17.report.json.
The older measurements below are historical, not current acceptance evidence.
This does not establish full WCAG conformance or certify later concurrent edits.

Scope: original brief E1-E7 and F week 3, plus the user's later green/white,
bright floral direction and natural Vietnamese marketing copy. This is a partial
acceptance audit, not a declaration that the project or WCAG certification is done.
The user-approved green direction overrides the brief's earlier palette examples.

Follow-up: the user's expanded-flower request adds 12 shared photographs after this
audit. Current photo evidence is in artifacts/flower-library-browser.log (six
passing cases). Zod Mini reduces shared validation code without changing rules;
the subsequent JS measurement is 4139 initial / 477439 fully interactive decoded
bytes, in artifacts/landing-js-budget.json. The original measurements below are
retained as a dated baseline. No new Lighthouse pass is claimed for this update.

## Baseline verdict (before follow-ups)

Implementation integrity: coherent storefront for flower-shop owners, with specific
package pricing, shop registration, kiosk locations and an explicitly labelled
conceptual cabinet. No fabricated testimonial or operational sales figure is used.
The bundled Impeccable source detector reported no findings in the scoped scan;
that does not substitute for manual accessibility or design review.

Provisional technical audit score: **13/20**, below the required 16/20. Scoring is
based on the scope of verified evidence, not just the automated a11y score.

| Dimension                | Score | Evidence and remaining limit                                                                                                                |
| ------------------------ | ----: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility            |   3/4 | Axe browser checks and pa11y pass; NVDA/Firefox, browser zoom and complete focus/target review are not verified.                            |
| Performance              |   2/4 | Lighthouse performance 99 and CLS 0; LCP still fails the explicit 2 s gate; fully interactive JS exceeds 100 kB.                            |
| Responsive               |   3/4 | 390/820/1440 browser checks plus 320px reflow/text spacing pass; complete physical touch/200% zoom review remains.                          |
| Theming                  |   2/4 | Shared green/white tokens exist, but landing CSS and map markers still use several literal colors. Dark mode is not required by this brief. |
| Implementation integrity |   3/4 | Product-specific content and assets; source detector empty. The older direction brief still documents the discarded yellow visual world.    |

## Findings

- **P1 - E7 performance acceptance is not met.** The final production measurement
  is LCP 2025.597 ms against <=2000 ms. Overall performance 99 does not override this
  failure. Initial measurement was 2115 ms. The hero's clip-path animation was
  removed, and its text entrance shortened to 450 ms; cabinet imagery now paints
  without entrance animation. One before/after run cannot prove that the entire
  timing difference was caused by this change. No thresholds were relaxed and no
  repeated runs were used to select a passing sample. Location: landing.css hero
  entrance and Layout.astro critical resource loading. Next: `$impeccable optimize`
  using the saved LCP phase/trace evidence, preserving the visual direction.
- **P1 - Whole-page JavaScript is above the brief's 100 kB budget.** At all three
  viewports, initial executable JS is 4139 bytes; after hydrating the map, gift
  demo and form it is 538821 decoded bytes. The encoded-response sum plus
  uncompressed inline scripts is 170741 bytes, also above 100 kB. React client,
  Leaflet, form and schema chunks dominate. Lazy loading protects initial display
  but does not eliminate later transfer/parse cost. Location: KioskMap.tsx,
  GiftDemo.tsx, Registration.tsx and emitted shared chunks. The original brief
  does not explicitly distinguish initial from total JS; only the initial-load
  reading is proven. Do not label the entire E7 requirement passed. Next:
  `$impeccable optimize`; inspect imports and requirements before replacing any
  framework or map capability.
- **P2 - Theme values are not centralized consistently.** Literal green/background
  shades in landing.css and yellow map marker fill in KioskMap.tsx bypass shared
  tokens. This makes later palette changes error-prone. It is not evidence of a
  contrast failure. Next: `$impeccable extract` for the existing approved palette.
- **P2 - Direction documentation is stale.** docs/landing-direction.md retains the
  previous yellow direction while DESIGN.md and rendered code use green/white.
  This can mislead a later contributor. Reported without incidental drift repair,
  per the skill's rule. Next: `$impeccable document` if refreshing that artifact is
  authorized.

No P0 issue was confirmed in this audit. Manual WCAG gaps are **unverified**, not
invented violations. No comprehensive manual WCAG pass is claimed.

## Baseline requirement evidence

| Brief item                                                      | Current evidence                                                                                                           | Acceptance state                                                                                    |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| E1 seller audience and registration conversion                  | index.astro shop-oriented copy; four-field Registration component; browser request-shape/error tests                       | Locally verified client behavior; real service integration has separate evidence in REQUIREMENTS.md |
| E2 init / shape / craft / audit / polish                        | PRODUCT.md, DESIGN.md, direction brief, current source and three viewport captures exist                                   | Partial: current audit below 16/20; mentor sign-off and final polish acceptance not proven          |
| E3 product truth / Vietnamese / imagery                         | Labelled conceptual cabinet, real flower photographs with asset provenance, explicit illustrative locations                | Verified in source and existing visual captures; no claim of real manufactured hardware photo       |
| E4 color / typography / layout                                  | Green/white current user direction, self-hosted Vietnamese Nunito/Be Vietnam Pro, numbered process only, semantic sections | Implemented; token/documentation findings above remain                                              |
| E4 motion                                                       | Text-only 450 ms entrance, content rendered in static HTML, reduced-motion rule                                            | Implemented; no new visual-world change                                                             |
| E5 eight sections and footer                                    | index.astro + Layout.astro; headings, price table, map list, gift demo, money, FAQ, registration, privacy link             | Present and browser-tested                                                                          |
| E6 text alternatives / semantics / labels / errors              | JSX/HTML inspection, axe at 390/820/1440, pa11y landing/privacy, registration error focus/status                           | Automated checks pass; full screen-reader experience not proven                                     |
| E6 keyboard / reflow / spacing                                  | Skip-link focus, 320px no overflow and letter/word-spacing test                                                            | Scoped checks pass; not equivalent to full keyboard journey or browser zoom                         |
| E6 200% zoom / NVDA+Firefox / focus visibility and target sizes | No current recorded manual session                                                                                         | Unverified; must not be inferred from axe                                                           |
| E7 LCP <2s / CLS <0.1                                           | Final Lighthouse 2025.597 ms / 0                                                                                           | LCP fails; CLS passes                                                                               |
| E7 JS <100 kB                                                   | Cold-context resource audit at three widths with served-build SHA-256 check                                                | Initial passes; full interactive payload fails                                                      |
| E7 SEO / formats / fonts                                        | Layout meta/OG, JSON-LD Organization/Product, sitemap integration, AVIF/WebP preload, font-display swap, lang=vi           | Present; production SITE_URL/domain still external configuration                                    |
| F3 pa11y / Lighthouse / screenshots / PR                        | pa11y 0 errors; Lighthouse a11y 100/performance 99; three viewport captures                                                | Partial: LCP gate fails, no remote PR/CI evidence                                                   |

## Reproduce and inspect

Build with `pnpm --filter @florabot/landing build`, then serve the production preview
at 127.0.0.1:4321. The JS audit rejects a server whose HTML does not match the built
index, preventing accidental measurement of a stale build or development server.

- `pnpm audit:landing-js`: records both initial and interactive sizes in
  artifacts/landing-js-budget.json. Exit status currently gates **initial decoded
  JS only**; the JSON explicitly records the failing interactive budget. The CI
  step name states this limited scope. It is not a replacement for the full E7 gate.
- `pnpm exec playwright test tests/browser/landing.spec.ts`: five passed;
  artifacts/landing-audit-browser.log and .impeccable/review/landing-{390,820,1440}.png.
- `pnpm exec pa11y-ci --config .pa11yci.cjs`: two URLs passed with zero errors;
  artifacts/landing-pa11y-current.log.
- `pnpm exec lhci autorun --config=lighthouserc.cjs`: **exit 1**, LCP gate failure;
  artifacts/landing-lighthouse-final.log and
  artifacts/lighthouse/127_0_0_1--2026_10_07_21_22_23.report.json.
- `pnpm lint`: exit 0; existing jsx-eslint MetaProperty diagnostic remains in
  artifacts/landing-audit-lint.log.
- Impeccable source scan: artifacts/landing-detector-current.json, no findings.

No dark-mode redesign, framework replacement, claim changes or backend behavior
changes were made. Finish any approved fixes with `$impeccable polish`; the current
audit does not approve release or certify complete WCAG 2.2 AA conformance.
