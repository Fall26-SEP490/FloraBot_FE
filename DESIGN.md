# FloraBot design system

## Operations dashboards

Admin, seller and staff share a white account header, forest-green grouped sidebar
and pale green work canvas. Desktop navigation stays available while scrolling;
at 900px and below it becomes an explicit disclosure with Escape focus recovery.
Active routes have a contrasting surface and aria-current. Business forms use the
same readable headings, persistent labels and controls of at least 44px.

Admin overview prioritizes open incidents, submitted staff reports and recent
flower requests. Seller overview shows active products, withdrawable/pending funds
and recent requests. Staff opens directly on assigned work, with a status filter
and a short workflow guide. Account metadata is secondary to actionable work.
Each overview feed loads and retries independently. Summaries use scoped API data,
identify first-page limits and never infer global totals from a partial page.
Missing balances are shown as unavailable, not zero. No decorative charts, motion,
new assets or new dependencies were introduced for these operational surfaces.

Verification and limits: docs/dashboard-accessibility.md.

## Authentication surfaces

The October 9 authentication revision uses one shared shell for member login,
registration, password recovery/reset and operations login. A white form sits on
a pale green canvas; a forest-green botanical panel and an existing bouquet photo
provide the desktop visual identity. At 800px and below the decorative panel is
hidden, so the form is the first task content. Public and staff authentication
retain their separate API realms.

Login/registration links form an active-page navigation row. Labels are persistent;
password rules precede submission; errors are linked to individual fields; server
feedback receives focus. Inputs and primary actions have at least 52px height,
secondary controls at least 44px. Error states include text as well as color.
Password visibility affects both password fields during registration/reset.
Recovery confirmation preserves account privacy and offers a way to correct email.
Recovery tokens remain in memory after removal from the address bar. There is no
decorative motion in these forms. Existing flower assets retain their provenance
in docs/assets.md; this revision adds no generated imagery or third-party services.

## Established website direction

Latest user-approved direction: a botanical storefront with forest green, warm ivory and leaf-yellow highlights. Be Vietnam Pro headings and body, Nunito wordmark, real flower photographs and an illustrated green conceptual cabinet. Screenprint floral graphics, coral accents and repeating botanical patterns give the landing its visual identity.

| Token  | Value               | Use                                            |
| ------ | ------------------- | ---------------------------------------------- |
| canvas | #fffdf7             | Main surface                                   |
| ink    | #183e2b             | Text and controls                              |
| brand  | #edf2d9             | Pale green sections                            |
| muted  | #495f4e             | Secondary text                                 |
| line   | #64735f             | Input and focus boundaries                     |
| accent | #e0ec9c             | Hero phrase, primary action and featured price |
| error  | oklch(0.43 0.17 28) | Error text                                     |

Landing headings: Be Vietnam Pro 800 for clear Vietnamese diacritics. Wordmark and photo captions: Nunito 800. Body: Be Vietnam Pro 400/600. Vietnamese and Latin subsets self-hosted. Base 18px. Display maximum 6rem, tracking -0.025em. Text measure 70ch. Borders 1px; radius 12px for controls and structured panels. No nested cards.

Focus: 3px solid ink with 4px white offset; minimum 44px touch target. The hero reveals its conceptual illustration once over 750ms; reduced motion displays it immediately. Buttons move their arrow by 3px on hover, disabled under reduced motion. Content remains visible without JS. No repeating animation. Workflow images unfold once when they enter the viewport; botanical section connectors slide their print once, and gift results enter as a short staggered list. All spatial animation is omitted under reduced motion. Mobile navigation stays visible. Pricing uses two distinct plan cards on desktop and mobile, with prominent monthly prices and capacity badges. The financial section uses a dark green band. The marketing landing has no circled-i information disclosures; FAQ remains expandable. Privacy-specific disclosures remain on the policy page. Essential prices and demo notices remain visible. Gift suggestions are an always-visible photograph-and-form panel with three budget buttons; map tiles load only after the user opens the map.

Forms use persistent labels, text errors and status announcements. Native details for FAQ. Maps have an equivalent location list. Money is tabular and formatted with vi-VN locale. Privacy uses a sticky contents column on desktop and a compact two-column contents grid on mobile, with visible primary facts and optional technical details.

The landing prioritizes photographs over explanatory text: three large illustrated sales steps, an uncaptioned eleven-image floral collection, and large locally optimized Unsplash photographs beside management benefits and FAQ. Short descriptions explain who does what in the sales flow; the marketing landing omits optional information dropdowns; prices, slot limits, demo labels and form labels remain visible. Image alternatives preserve descriptions for assistive technology.

Copy names the actual service and section purpose: monthly slot rental, purchasing at the cabinet, locations, reference flower photographs, orders and sales funds. Avoid rhyming slogans, ambiguous promises, and flower photographs presented as process illustrations.

Hero title has two authored phrase lines. Headings use balanced wrapping and prohibit splitting inside words; paragraphs use pretty wrapping where supported. Text still reflows at 200% resize rather than forcing unbreakable oversized phrases.

References: https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap (balanced heading lines and pretty paragraphs), https://web.dev/articles/prefers-reduced-motion (motion preferences and vestibular accessibility). Automated contrast and keyboard checks validate the implementation, not complete accessibility conformance.

Graphic hierarchy: a low-opacity botanical repeat behind hero copy, a full-color floral divider, and muted patterned pricing and registration backgrounds. Solid surfaces keep prices and form controls legible; a coral underline emphasizes the service phrase. The hero illustration has descriptive alternative text; its visible concept caption was removed at the user's request. Assets use cx/gpt-image-2.5, generated through the user-selected local service on 2026-10-08.

Workflow layout keeps three columns above 1050px, image-and-text rows on tablet, and full-width stacked figures on mobile. Step numbers sit above the copy to preserve its reading width. Six understated section links connect the journey from workflow through pricing, locations, flowers, management, FAQ and registration. Footer links have scroll margins so keyboard focus remains fully visible.

Gift selection: a large bouquet photograph anchors a solid form surface. Recipient and occasion share a row only when space allows; tone and budget have full width. Budget buttons use compact 300k/500k/700k labels on mobile with complete currency accessible names. Changing any criteria clears obsolete results. Results retain existing budget/tag filtering and animate on each submit. The user requested removing visible demo captions from the collection and picker; asset provenance remains in docs/assets.md. Botanical repeats now connect workflow, locations, FAQ and collection with patterned section links.

Wide-screen surfaces: hero, botanical divider and landing sections extend edge to edge. Section padding keeps content at a 1310px measure while backgrounds cover 1920px and 2560px screens. Body also carries the botanical print so header/footer gutters are not empty white. Native Web Animations API sequences hero phrase lines and introduces section headings, workflow copy and large photographs once on intersection. No animation dependency is added; changing reduced-motion preferences cancels active entrance animations. Content remains visible if scripting fails.

Horizontal motion revision: hero phrase lines enter from opposite sides with 100ms sequencing. Section headings and workflow copy alternate direction by section/step; photographs translate horizontally with only a subtle scale change. Text has no vertical movement or clipping mask. Entrances take 1000-1100ms with cubic-bezier(.22,1,.36,1), while mobile travel is capped by viewport width. Workflow illustration masks reveal horizontally and result cards enter from the left. Main overflow uses clip to avoid transient horizontal scrollbars without creating a scrolling container. Reduced-motion behavior is preserved.
