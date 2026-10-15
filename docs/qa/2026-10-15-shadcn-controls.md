# Shared UI controls and company logos — 15 October 2026

The web UI now uses shadcn Native Select, Input, Textarea, Checkbox, Button, Tabs, Toggle Group, Badge, and Avatar components. Page CSS arranges select wrappers; the shared select owns its arrow and padding. The logo registry contains 25 companies, with assets stored locally and source URLs recorded in `apps/web/lib/company-logos.json`. Unknown companies and failed images show initials.

## Verification

- `pnpm test`: 134 passed, 0 failed.
- `pnpm typecheck`: web and mobile passed.
- `pnpm build`: passed; the temporary preview route is absent from the build.
- `git diff --check`: passed.
- Jobs board: all six dropdown chevrons have a measured vertical center offset of 0px. Checked desktop (1440px) and mobile (390px), light and dark themes, no document overflow. Technology checkbox updates its state and the URL. Selecting three roles checks three comparison boxes and disables the other nine first-page boxes; the comparison link contains the three selected IDs.
- Tracker fixtures: tab changes work with mouse and arrow keys; table/board toggle changes layout. Stage, filter, progress, editor priority/stage, interview status, account currency/period, email mode, and publish form dropdowns use the same shared component. Measured dropdown offsets on the inspected screens were 0px.
- Editor: fixed tab-container overflow; dialog content fits at 390px. Form and publish dialog have no horizontal overflow.
- Logos: all 12 first-page job images loaded; all 21 mapped company-directory images loaded; homepage preview and featured roles loaded their mapped logos. Initials remain available for unmapped companies.
- Private screens used temporary local fixtures without saving profile, tracker, or email settings. The fixture route was removed before production build. Authenticated persistence was not exercised during this UI pass.

## Screenshots

- [Desktop jobs, dark](../screenshots/shadcn-jobs-desktop-dark.png)
- [Mobile filters, light](../screenshots/shadcn-filters-mobile-light.png)
- [Mobile filters, dark](../screenshots/shadcn-filters-mobile-dark.png)
- [Company directory, dark](../screenshots/company-logos-desktop-dark.png)
