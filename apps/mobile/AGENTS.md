# Mobile App Guidelines

This workspace is Expo React Native with Expo Router. Build native screens using React Native components; do not import web UI, Next.js, `@frontlanejobs/core`, or database modules. Frontend API types come from `@frontlanejobs/contracts`.

Use the SDK-compatible versions installed through `pnpm --filter @frontlanejobs/mobile exec expo install`. Keep the root pnpm lockfile. Run root `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm mobile:export`, and `pnpm --filter @frontlanejobs/mobile run doctor`.

Private profile and tracker data stays in memory. Store bearer tokens only in Expo SecureStore. All API requests go through `src/api.mjs`; retain credentials omission, session expiry, stale-request guards, and publication retry IDs. Use atomic `action:'save'` tracker requests for initial saving and full application requests only for explicit edits.

Generated `.expo`, `dist`, `ios`, and `android` directories are ignored. Native config changes go in config plugins and require a development-client rebuild. See `docs/MOBILE.md` for OAuth and build setup.
