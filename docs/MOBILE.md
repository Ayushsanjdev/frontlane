# FrontlaneJobs mobile

The Expo React Native app lives in `apps/mobile/`, alongside the existing web app and worker. It targets iOS and Android with Expo SDK 57 and Expo Router. Jobs, Tracker, and Account are native screens; the Next.js application remains the API server. Native Google sign-in requires an Expo development build, rather than Expo Go.

## Local setup

From the repository root, use the Node and pnpm versions described in the main README:

```sh
pnpm install --frozen-lockfile
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm db:migrate
pnpm dev
```

Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local` to your backend origin. For a physical device, use the computer's LAN IP, such as `http://192.168.1.10:3000`, and keep both devices on the same network. iOS Simulator can use `http://localhost:3000`; Android Emulator normally uses `http://10.0.2.2:3000`. Use HTTPS for a deployed backend. The root `.env.local` supplies database and web authentication configuration; the mobile file supplies only public app configuration.

Build and install a development client, then start Metro:

```sh
pnpm mobile:ios
# Or, with Android Studio and an emulator/device configured:
pnpm mobile:android
pnpm mobile:dev
```

The platform commands can start Metro themselves. `mobile:dev` is useful for subsequent sessions with the client already installed. Rebuild after changing native dependencies, OAuth identifiers, or config plugins. Native projects are generated and ignored by git. Browsing builds without OAuth credentials; sign-in explains missing configuration.

## Google sign-in

Use the existing Google Cloud project so website and mobile identities match. Set up:

- A web OAuth client. Set its ID as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in mobile configuration and `MOBILE_GOOGLE_AUDIENCE` on the backend. The backend falls back to `AUTH_GOOGLE_ID` if the mobile audience is unset. Never put the OAuth client secret in mobile environment variables.
- An iOS OAuth client matching the configured bundle identifier. Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; its reversed client ID is registered by the config plugin.
- An Android OAuth client matching the package identifier and SHA-1 of the signing certificate. Configure development, EAS, and Google Play signing fingerprints as applicable. Android obtains an ID token targeting the web client ID through Credential Manager.

The default bundle/package identifier is `com.frontlanejobs.mobile`; change `MOBILE_APP_ID` before registering platform clients if your organization uses another identifier. Rebuild the development client after setting credentials. The app uses explicit Google sign-in and handles cancellation without showing an error.

The iOS configuration adopts Expo's scene lifecycle for Xcode 27. A local config plugin forwards Google callback URLs through AppDelegate; Expo's scene delegate forwards both warm and cold-start URL events there. React Native links still fall through to the normal handler.

References: [Expo native Google authentication](https://docs.expo.dev/guides/google-authentication/), [Nitro Expo configuration](https://react-native-nitro-google-sign-in.github.io/docs/setup/expo), and [Expo monorepos](https://docs.expo.dev/guides/monorepos/).

## Backend sessions and API contracts

Apply migration `004-mobile-sessions.sql` with `pnpm db:migrate` before enabling mobile authentication on the backend. It adds `mobile_sessions`; existing jobs, profiles, and applications retain their schema.

- `POST /api/mobile/session` accepts `{idToken}` and returns `{token,user,expiresAt}`. The server verifies Google's RS256 signature, issuer, configured audience, expiration, issued-at time, and verified email. `user.userId` is the existing `google:<subject>` account identifier.
- `GET /api/mobile/session` accepts `Authorization: Bearer <token>` and returns `{user,expiresAt}`.
- `DELETE /api/mobile/session` revokes that device session. It is idempotent for a well-formed token.

Sessions last 30 days and then require Google sign-in again. The database stores only a SHA-256 token hash. Raw tokens stay in Expo SecureStore; private profile/tracker data stays in memory. Sign-out revokes the server token before clearing local state; connection failures show a retryable error. Do not log ID tokens or bearer credentials. Expired sessions for an account are removed when it signs in again; operational cleanup can also delete rows where `expires_at <= now()`.

Existing profile, tracker, and job-posting endpoints accept mobile bearer sessions. Browser cookie writes retain their same-origin checks. An invalid bearer credential never falls back to a browser session. The native client omits cookies.

`POST /api/tracker` additionally accepts `{action:'save',job}` for atomic initial saving. A concurrent existing application is returned unchanged, preserving its stage, notes, answers, and dates. Explicit application edits use the existing full application request. Both web and mobile initial save buttons use the new action.

Shared frontend-safe types are exported by `@frontlanejobs/contracts`; mobile does not import core/database server modules. Publication retries reuse a submission ID for identical fields. There is no offline write queue, push notification integration, or local private-data cache.

## Verification and builds

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm mobile:export
pnpm --filter @frontlanejobs/mobile run doctor
```

Expo Doctor's schema and React Native Directory checks require network access. The export command creates Android/iOS Hermes bundles and a web preview; it does not compile an APK or IPA. The web preview is for checking layouts and browsing; Google authentication and secure session storage are native-only. Browser previews need the backend to permit their separate origin, or a local development proxy; native requests are not subject to browser CORS.

Manual checks: both themes and small/tablet screens; keyboard scrolling; search/filter changes and pagination; missing-job and unavailable-feed errors; Google cancellation and session restoration; save/update/delete tracker data; profile edits; duplicate/rate-limited job submissions; sign-out and web/mobile account synchronization. Live Google authentication needs configured OAuth clients and signed development binaries.

`eas.json` includes development, internal preview, and production profiles. Link an Expo project and set `EAS_PROJECT_ID` before using EAS. Run build commands from `apps/mobile/`, for example `eas build --profile development --platform ios` or `eas build --profile preview --platform android`. Supply public environment variables for that build environment, and configure signing credentials through EAS. Project creation, remote builds, deployment, and app-store submission are separate operations.
