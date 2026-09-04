# Taskr mobile

The Expo app for Taskr — team members log their day and work through their tasks;
managers assign work, read reports and triage tickets. It talks to the same API and
database as the web app (`../backend`), so everything is shared.

## Run it on your phone

```bash
# 1. API, from the repo root (SQLite locally; see ../README.md)
PORT=4000 npm run dev:backend

# 2. App
cd mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** (App Store / Play Store) on a phone on the same Wi-Fi.
The app finds the API by itself: it uses the address Metro is serving from (your
laptop's LAN IP) with port 4000, so nothing needs configuring. On Windows, allow inbound
TCP 4000 in Defender Firewall the first time or the phone will time out.

To point at another API (a tunnel, staging, production) set it in `.env`:

```
EXPO_PUBLIC_API_URL=https://your-taskr.vercel.app
```

## Layout

```
app.config.ts        manifest (scheme taskr://, plugins, dev-only cleartext HTTP)
eas.json             EAS build profiles: development (dev client), preview, production
src/
  app/               expo-router routes
    (auth)/          onboarding, login, set-password, forgot/reset password
    (app)/           signed-in tree, guarded by role
      (member)/      tabs: Home · Tasks · Report · Tickets · More
      (manager)/     tabs: Home · Tasks · Team · Tickets · More
      tasks/, tickets/, team/, projects/, reports, analytics, notifications, my-day, profile/, labels
  api/               fetch client (bearer token, X-Client-Timezone), typed endpoints, query keys
  auth/              session store (SecureStore-backed) and boot
  hooks/             TanStack Query hooks, one file per domain, with optimistic updates
  push/              Expo push registration, tap routing, badge sync
  components/        the design system: Screen, HeroPanel, BentoCard, PillButton, Chips, Sheet…
  features/          TaskCard, ReportCard, ActivityThread, Checklist, TimelineStrip…
  theme/             tokens (colours, type, radius, motion) and ThemeProvider (light / dark / system)
  types/, lib/       copied from ../frontend (types, formatting) plus mobile helpers
```

## Design

The look follows the reference: a periwinkle hero with thin white orbit line-art, white
rounded bento cards on a lavender ground, a pale-yellow accent, ink pill buttons and a
floating frosted-glass tab bar. Motion is deliberately calm — staggered fade-ups, spring
press-scale, a sliding segmented pill, count-up numbers — and every toggle has a light
haptic. Status, priority and severity colours mean the same thing as on the web.

Tokens live in `src/theme/tokens.ts`; components read them through `useTheme()`. Dark
mode is a per-device choice (More › Appearance) that can disagree with the OS.

## Push notifications

Push needs an EAS project id and a development build — Expo Go on Android cannot
receive remote pushes.

```bash
npx eas-cli login
npx eas-cli init                 # writes the project id; put it in EAS_PROJECT_ID or app.config.ts
npx eas-cli credentials          # Android: upload the FCM V1 service-account key; iOS: APNs key
npx eas-cli build --profile development --platform android   # or ios
```

Install the build, sign in, accept the prompt on the Home card. The phone registers at
`POST /api/devices`; every notification the API creates is then pushed here. Test one
from https://expo.dev/notifications with `data: {"url":"taskr://tasks/1"}` — a tap opens
that task, cold start included. Without push permission the app polls the unread count
every 20 seconds while in the foreground, as the web app does.

## Deep links

`taskr://tasks/12`, `taskr://tickets/4`, `taskr://team/7`, `taskr://notifications`,
`taskr://reset-password?token=…`. Try one on a connected device with
`npx uri-scheme open "taskr://tasks/1" --android`.

## Checks

```bash
npx tsc --noEmit        # types
npx expo-doctor         # dependency compatibility
node scripts/make-icons.mjs   # regenerate the icon set
```
