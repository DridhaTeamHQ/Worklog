/**
 * Design tokens for the Taskr mobile app.
 *
 * Concept: "warm precision". A white screen, light-grey cards with a hairline edge,
 * near-black type, and one warm accent — orange — used only where it means
 * "this is the number", "this is active" or "go here". Charts draw in the same
 * orange with white-filled dots; a secondary blue exists solely for a comparison
 * series. Dark is true black with tonal surfaces and the accent lifted for contrast.
 *
 * Restraint is the rule: one accent, sentence case, colour only where it carries
 * meaning (status, priority, severity keep the web app's semantics).
 */

export const palette = {
  light: {
    // The accent. `hero` is its historical name — every "brand" use points here.
    hero: '#F26E1C',
    heroDeep: '#D95A10',
    heroSoft: '#FF8A45',
    heroLine: 'rgba(255,255,255,0.5)',
    onHero: '#FFFFFF',
    onHeroMuted: 'rgba(255,255,255,0.75)',
    accentSoft: 'rgba(242,110,28,0.12)',

    ground: '#FFFFFF',
    card: '#F6F6F8',
    cardAlt: '#ECECF0',
    border: 'rgba(17,18,20,0.07)',
    hairline: 'rgba(17,18,20,0.06)',
    glass: 'rgba(255,255,255,0.82)',
    glassBorder: 'rgba(17,18,20,0.06)',
    scrim: 'rgba(17,18,20,0.42)',
    tooltip: '#1E1E22',
    onTooltip: '#FFFFFF',

    ink: '#111214',
    inkMuted: '#6E7178',
    inkFaint: '#A5A8B0',

    accent: '#F26E1C',
    onAccent: '#FFFFFF',
    pill: '#111214',
    onPill: '#FFFFFF',

    // Blue is the comparison series and "informational" chips only — never a second accent.
    info: '#3B6CF6',
    success: '#1F9D63',
    warning: '#D0900E',
    danger: '#DD4343',
    infoSoft: 'rgba(59,108,246,0.12)',
    successSoft: 'rgba(31,157,99,0.12)',
    warningSoft: 'rgba(208,144,14,0.14)',
    dangerSoft: 'rgba(221,67,67,0.12)',
    neutralSoft: 'rgba(17,18,20,0.06)',
  },
  dark: {
    hero: '#FF7A2E',
    heroDeep: '#E8631A',
    heroSoft: '#FF9558',
    heroLine: 'rgba(255,255,255,0.32)',
    onHero: '#FFFFFF',
    onHeroMuted: 'rgba(255,255,255,0.72)',
    accentSoft: 'rgba(255,122,46,0.16)',

    ground: '#000000',
    card: '#0E0E10',
    cardAlt: '#18181B',
    border: 'rgba(255,255,255,0.09)',
    hairline: 'rgba(255,255,255,0.07)',
    glass: 'rgba(14,14,16,0.82)',
    glassBorder: 'rgba(255,255,255,0.10)',
    scrim: 'rgba(0,0,0,0.6)',
    tooltip: '#2A2A2F',
    onTooltip: '#FFFFFF',

    ink: '#F4F4F6',
    inkMuted: '#9A9AA4',
    inkFaint: '#5B5B64',

    accent: '#FF7A2E',
    onAccent: '#FFFFFF',
    pill: '#FFFFFF',
    onPill: '#000000',

    info: '#7A9BF5',
    success: '#3FD68E',
    warning: '#F0B441',
    danger: '#F27070',
    infoSoft: 'rgba(122,155,245,0.16)',
    successSoft: 'rgba(63,214,142,0.16)',
    warningSoft: 'rgba(240,180,65,0.16)',
    dangerSoft: 'rgba(242,112,112,0.16)',
    neutralSoft: 'rgba(255,255,255,0.07)',
  },
} as const;

export type ColorName = keyof typeof palette.light;
export type Colors = Record<ColorName, string>;

/**
 * Which semantic colour a status/priority/severity renders with. Pending is quiet
 * (grey), in progress is the accent, done is green, overdue is red — four states,
 * four unmistakable colours.
 */
export const semantics = {
  status: { pending: 'inkMuted', in_progress: 'hero', completed: 'success', overdue: 'danger', idle: 'inkMuted' },
  priority: { low: 'inkMuted', medium: 'inkMuted', high: 'warning', urgent: 'danger' },
  severity: { low: 'inkMuted', medium: 'info', high: 'warning', critical: 'danger' },
  ticket: { open: 'danger', in_progress: 'hero', resolved: 'success', closed: 'inkMuted' },
} as const;

/** The tinted background that goes with each semantic colour. */
export const softOf: Record<string, ColorName> = {
  hero: 'accentSoft', info: 'infoSoft', success: 'successSoft', warning: 'warningSoft', danger: 'dangerSoft', inkMuted: 'neutralSoft',
};

export const radius = { xs: 8, sm: 12, md: 14, lg: 20, xl: 24, xxl: 32, pill: 999 } as const;

/** An 8pt rhythm. `screen` is the horizontal page margin, `stack` the gap between cards. */
export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40, screen: 24, stack: 20, section: 32,
} as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Sentence case throughout; weight and size carry the hierarchy, not caps or colour. */
export const type = {
  /** The one huge number at the top of a metric screen. */
  hero: { fontSize: 56, lineHeight: 60, fontFamily: fonts.extrabold, letterSpacing: -2.2 },
  /** The same idea at list-screen scale. */
  heroSm: { fontSize: 44, lineHeight: 48, fontFamily: fonts.extrabold, letterSpacing: -1.6 },
  /** The unit beside it — lighter, smaller, muted. */
  unit: { fontSize: 20, lineHeight: 26, fontFamily: fonts.regular, letterSpacing: -0.3 },
  display: { fontSize: 36, lineHeight: 42, fontFamily: fonts.extrabold, letterSpacing: -1.2 },
  h1: { fontSize: 30, lineHeight: 36, fontFamily: fonts.bold, letterSpacing: -0.8 },
  h2: { fontSize: 24, lineHeight: 30, fontFamily: fonts.bold, letterSpacing: -0.5 },
  h3: { fontSize: 18, lineHeight: 24, fontFamily: fonts.semibold, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 23, fontFamily: fonts.regular },
  bodyStrong: { fontSize: 15, lineHeight: 23, fontFamily: fonts.semibold },
  small: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular },
  smallStrong: { fontSize: 13, lineHeight: 19, fontFamily: fonts.semibold },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fonts.medium, letterSpacing: 0.1 },
  mono: { fontSize: 12, lineHeight: 16, fontFamily: fonts.semibold, letterSpacing: 0.2 },
  stat: { fontSize: 34, lineHeight: 38, fontFamily: fonts.bold, letterSpacing: -1 },
} as const;

/** Cards sit on the ground by tone and a hairline; shadows are for the few things that float. */
export const shadow = {
  card: {
    shadowColor: '#111214', shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 0,
  },
  float: {
    shadowColor: '#111214', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  hero: {
    shadowColor: '#D95A10', shadowOpacity: 0.2, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 6,
  },
} as const;

/** Motion timings — calm, never snappy. */
export const motion = {
  fast: 180,
  base: 280,
  slow: 420,
  spring: { damping: 18, stiffness: 180, mass: 0.9 },
  pressScale: 0.98,
} as const;

/** Space the floating tab bar needs at the bottom of a scrolling screen. */
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_INSET = 24;
