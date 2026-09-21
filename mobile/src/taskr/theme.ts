import { StyleSheet } from 'react-native';

export const palette = {
  ink: '#fafafa',
  muted: '#a1a1aa',
  blue: '#f4553c', // Aligns primary with website Coral #f4553c
  coral: '#f4553c',
  coralStrong: '#ff755e',
  line: '#27272a',
  canvas: '#09090b',
  blueLight: 'rgba(244, 85, 60, 0.16)',
  green: '#22c55e',
  greenLight: 'rgba(34, 197, 94, 0.16)',
  amber: '#eab308',
  amberLight: 'rgba(234, 179, 8, 0.16)',
  red: '#ef4444',
  redLight: 'rgba(239, 68, 68, 0.16)',
  purple: '#a855f7',
  purpleLight: 'rgba(168, 85, 247, 0.16)',
};

export const teamStyle = (name: string) => {
  if (/content|marketing/i.test(name)) return { color: palette.red, bg: palette.redLight, icon: 'play-circle-outline' as const };
  if (/design|graphic/i.test(name)) return { color: palette.amber, bg: palette.amberLight, icon: 'color-palette-outline' as const };
  if (/hr|human/i.test(name)) return { color: palette.purple, bg: palette.purpleLight, icon: 'people' as const };
  return { color: palette.coral, bg: palette.blueLight, icon: 'code-slash' as const };
};

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 85, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  grow: { flex: 1, minWidth: 0 },
  title: { color: palette.ink, fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  heading: { color: palette.ink, fontSize: 15, fontWeight: '700', letterSpacing: -0.15 },
  body: { color: palette.ink, fontSize: 13, lineHeight: 18 },
  muted: { color: palette.muted, fontSize: 11.5, lineHeight: 16 },
  subtitle: { color: palette.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  link: { color: palette.coralStrong, fontSize: 12, fontWeight: '600' },
  card: { backgroundColor: '#18181b', borderRadius: 10, borderWidth: 1, borderColor: '#27272a', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 1 },
  iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: palette.coral, borderRadius: 8, minHeight: 38, paddingHorizontal: 13, paddingVertical: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  primaryText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  label: { color: palette.ink, fontSize: 12, fontWeight: '600', marginBottom: 5 },
  input: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 8, color: palette.ink, minHeight: 36, paddingHorizontal: 11, paddingVertical: 7, fontSize: 13 },
  section: { gap: 10 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  empty: { padding: 24, alignItems: 'center', gap: 8 },
  divider: { height: 1, backgroundColor: palette.line },
});
