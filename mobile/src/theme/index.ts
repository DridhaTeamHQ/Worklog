export const colors = {
  // Backgrounds & Surfaces (Website Dark Mode Zinc Palette)
  background: '#09090b',
  canvas: '#09090b',
  card: '#18181b',
  cardHover: '#27272a',
  cardBorder: '#27272a',
  cardBorderHighlight: '#3f3f46',

  // Foreground / Text (Dark Zinc Scale)
  text: '#fafafa',
  textSecondary: '#d4d4d8',
  textMuted: '#a1a1aa',
  textDisabled: '#71717a',

  // Brand / Accents (Vibrant Coral #f4553c)
  primary: '#f4553c',
  primaryHover: '#ff6650',
  primaryLight: 'rgba(244, 85, 60, 0.16)',
  primaryBorder: 'rgba(244, 85, 60, 0.38)',
  primaryStrong: '#ff755e',

  secondary: '#27272a',
  secondaryForeground: '#fafafa',
  secondaryLight: 'rgba(255, 255, 255, 0.08)',

  // Status & Priority Colors (Dark Mode Semantic Tokens)
  success: '#22c55e',
  successLight: 'rgba(34, 197, 94, 0.16)',
  successBorder: 'rgba(34, 197, 94, 0.35)',

  warning: '#eab308',
  warningLight: 'rgba(234, 179, 8, 0.16)',
  warningBorder: 'rgba(234, 179, 8, 0.35)',

  danger: '#ef4444',
  dangerLight: 'rgba(239, 68, 68, 0.16)',
  dangerBorder: 'rgba(239, 68, 68, 0.35)',

  info: '#3b82f6',
  infoLight: 'rgba(59, 130, 246, 0.16)',
  infoBorder: 'rgba(59, 130, 246, 0.35)',

  purple: '#a855f7',
  purpleLight: 'rgba(168, 85, 247, 0.16)',

  // Priority specifics
  priorityLow: '#22c55e',
  priorityMedium: '#3b82f6',
  priorityHigh: '#eab308',
  priorityUrgent: '#ef4444',

  // Status specifics
  statusPending: '#eab308',
  statusInProgress: '#3b82f6',
  statusCompleted: '#22c55e',
  statusOverdue: '#ef4444',

  // Input & Forms
  inputBg: '#18181b',
  inputBorder: '#27272a',
  inputFocusBorder: '#f4553c',
  placeholder: '#71717a',

  // Misc
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
  divider: '#27272a',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12, // 0.75rem shadcn standard radius
  xl: 16,
  full: 9999,
};

export const typography = {
  fontFamily: undefined, // Uses native modern system sans-serif (SF Pro / Roboto)
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
};
