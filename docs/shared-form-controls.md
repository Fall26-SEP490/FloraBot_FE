# Shared form controls

Use `shared/components/Select` for dropdown fields. It accepts native select props and
`option` children while rendering the same `CustomSelect` menu used by seller and the
date picker. The native element retains names, required constraints, FormData values,
change/blur events and refs for existing form controllers. It is hidden from assistive
technology and keyboard navigation; the visible combobox owns the field label and errors.
Controlled values, defaults and form resets remain supported. Dropdown browser tests use
`chooseSelect` from `tests/fixtures/select.ts`.
Tests that already locate a field can use `chooseOption(locator, value)`; it opens the
visible custom menu and falls back to native selection only for ordinary native controls.

All web routes install `FormFeedback` once in `SiteFrame`, including forms in body portals.
Native required, format, length and numeric constraints show Vietnamese inline errors via
`shared/lib/form-validation.ts`. Existing business validation stays in its feature.
Errors have no colored background; descriptions and focus link to the invalid control.

Use `shared/components/VietnamDateInput` for dates, months and times. Supported `kind` values
are `date`, `month`, `time` and `datetime-local`. Pass a labelled `id`, `value` and
`onValueChange`; optional `required`, `min`, `max`, `disabled`, `name`, `invalid`,
`describedBy` and `triggerRef` preserve form semantics and focus.

Values use `YYYY-MM-DD`, `YYYY-MM`, `HH:mm` or `YYYY-MM-DDTHH:mm`. The UI displays
Vietnamese dates and 24-hour time. Calendar dates remain dates, without a UTC conversion.
For API timestamps, use `vietnamDateTimeToUtc` to convert a selected Vietnam wall-clock
time to UTC, and `vietnamDateTime` to display an API instant in UTC+7. Avoid parsing
an unzoned date-time with `new Date(value)`, which uses the device timezone.

Browser tests use `chooseVietnamDate` in `tests/fixtures/vietnam-date.ts` to interact
with the actual picker. Shared control and seller tests also run with the browser
timezone set to America/New_York to check independence from the device setting.
