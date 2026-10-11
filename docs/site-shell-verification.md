# Shared site shell and rendering - 2026-10-11

## Changes

- `app/layout.tsx` owns `SiteFrame`, the query provider and ordered shared styles.
- `SiteFrame.tsx` supplies the public header, responsive navigation, brand and
  common footer. Operations keep their contextual header and sidebar.
- Marketing, catalog, account and authentication no longer render competing headers.
- Internal header/footer links use Next navigation without a document reload.
- Login removes repeated promotional copy and duplicate account tabs while retaining
  validation, password visibility, registration and recovery links.
- Session queries reuse fresh data for 30 seconds. Realtime refreshes on events;
  global polling is retained only while disconnected. Existing per-module timers,
  permission checks and explicit recovery actions are preserved.

## Checks

- Full portal suite: 127 passed after shell integration.
- Public browser suite: 23 passed, including sticky anchors and complete keyboard
  traversal. After removing the final duplicate auth tabs, 18 focused form/shell
  tests passed again.
- The local Next Docker service was rebuilt and restarted at port 8088; all four
  deployed route/authentication smoke tests passed.
- New `site-shell.spec.ts` covers 390px/1440px, persistent header/footer DOM across
  marketing/catalog navigation, a single document load, menu Escape/focus behavior,
  Axe A/AA scans and retained search input.
- In the idle catalog test, advancing 65 seconds produces no additional session
  or catalog requests. This is a network stability check, not a claim that React
  never renders when route, data or user input changes.
- Realtime tests cover no redundant global polling while a WebSocket is connected,
  refreshed data and preserved focus on events/reconnect, cleanup on logout, and
  periodic recovery while disconnected.
- Build and lint passed. Form accessibility is covered for login, registration,
  recovery and reset on desktop/mobile, including invalid states.

The tests use isolated API fixtures. Automated Axe results do not constitute a
complete WCAG certification or a substitute for manual screen-reader testing.
