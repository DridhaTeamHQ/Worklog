import type { ExpoConfig } from 'expo/config';

/**
 * The app manifest. A TS config rather than app.json so the dev-only settings —
 * cleartext HTTP to a laptop on the LAN, local networking on iOS — are switched on by
 * the build profile (`APP_VARIANT=development` in eas.json) and never ship in a
 * production binary.
 */
const IS_DEV = process.env.APP_VARIANT === 'development';

const config: ExpoConfig = {
  name: IS_DEV ? 'Taskr (dev)' : 'Taskr',
  slug: 'taskr',
  version: '1.0.0',
  scheme: 'taskr',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  ios: {
    bundleIdentifier: IS_DEV ? 'com.dridhatechnologies.taskr.dev' : 'com.dridhatechnologies.taskr',
    supportsTablet: false,
    infoPlist: {
      ...(IS_DEV ? { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } } : {}),
      UIBackgroundModes: ['remote-notification'],
    },
  },
  android: {
    package: IS_DEV ? 'com.dridhatechnologies.taskr.dev' : 'com.dridhatechnologies.taskr',
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: '#5B7FE8',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  // Client-rendered only: web is a preview surface, not a product target, and the
  // static pre-render trips over a dependency's tslib interop.
  web: { output: 'single', favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    [
      'expo-splash-screen',
      { backgroundColor: '#080A09', image: './assets/images/splash-icon.png', imageWidth: 120 },
    ],
    [
      'expo-notifications',
      { icon: './assets/images/notification-icon.png', color: '#466451', defaultChannel: 'default' },
    ],
    ['expo-build-properties', { android: { usesCleartextTraffic: IS_DEV } }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    // Filled in by `npx eas-cli init` (needed for push tokens); see mobile/README.md.
    eas: { projectId: process.env.EAS_PROJECT_ID || '' },
  },
};

export default config;
