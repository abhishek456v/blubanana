// Design tokens from DESIGN.md — always pull from here, never hardcode values.

export const Colors = {
  light: {
    bgPage: '#FDFBF9',
    bgSurface: '#F6F2EC',
    bgSurfaceRaised: '#FFFFFF',
    border: 'rgba(20,18,16,0.08)',
    borderStrong: 'rgba(20,18,16,0.16)',
    textPrimary: '#1C1815',
    textSecondary: '#6B6259',
    textMuted: '#9A9186',
    fillPrimary: '#F5A623',
    onFillPrimary: '#FFFFFF',
    accent: '#F5A623',
    accentLight: 'rgba(245,166,35,0.12)',
    accentHover: '#E0951A',
    success: '#1A7A35',
    successLight: 'rgba(26,122,53,0.10)',
    warning: '#8B5000',
    warningLight: 'rgba(139,80,0,0.10)',
    danger: '#C0392B',
    dangerLight: 'rgba(192,57,43,0.10)',
    info: '#0051A8',
    infoLight: 'rgba(0,81,168,0.10)',
  },
  dark: {
    bgPage: '#141210',
    bgSurface: '#221F1B',
    bgSurfaceRaised: '#2C2822',
    border: 'rgba(255,255,255,0.07)',
    borderStrong: 'rgba(255,255,255,0.16)',
    textPrimary: '#F5F0E8',
    textSecondary: '#A89F94',
    textMuted: '#6B6259',
    fillPrimary: '#F5A623',
    onFillPrimary: '#FFFFFF',
    accent: '#F5A623',
    accentLight: 'rgba(245,166,35,0.14)',
    accentHover: '#FFC55A',
    success: '#4ADE80',
    successLight: 'rgba(74,222,128,0.14)',
    warning: '#FBBF24',
    warningLight: 'rgba(251,191,36,0.14)',
    danger: '#F87171',
    dangerLight: 'rgba(248,113,113,0.14)',
    info: '#60A5FA',
    infoLight: 'rgba(96,165,250,0.14)',
  },
} as const

// Flat, hashed-by-name avatar background colors (Contacts/Messages-style —
// no gradients, since expo-linear-gradient isn't a dependency and a flat
// chip reads just as premium without it). Same list works in both color
// schemes; text on top is always white.
export const AvatarPalette = [
  '#F5A623', // amber (brand accent)
  '#60A5FA', // blue
  '#4ADE80', // green
  '#F87171', // red
  '#C084FC', // violet
  '#FB923C', // orange
  '#38BDF8', // sky
  '#F472B6', // pink
] as const

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const

export const Typography = {
  display: { fontSize: 28, fontWeight: '600' as const },
  title: { fontSize: 20, fontWeight: '600' as const },
  heading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '500' as const },
} as const

export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  // Syne is the display/editorial voice — screen titles, the dashboard
  // greeting, big currency numbers. Everything else (body, labels, inputs)
  // stays on Inter so the UI doesn't read as "all headline."
  display: 'Syne_600SemiBold',
  displayBold: 'Syne_700Bold',
} as const

// Below `wide`, the app uses the mobile layout (bottom tab bar, edge-to-edge
// content). At or above it, DESIGN.md 4 calls for a sidebar instead of a
// bottom tab bar — 768 matches react-navigation's own tablet threshold, so
// the sidebar switch and the library's internal label-layout switch agree.
export const Breakpoints = {
  wide: 768,
} as const

export const SidebarWidth = 240

// Caps how wide list/form content gets next to the sidebar so text and
// inputs don't stretch edge-to-edge on a desktop-size viewport.
export const ContentMaxWidth = 720

// Sign-in/sign-up have no sidebar to sit next to — they're centered,
// standalone screens — so they get their own, narrower cap instead of
// ContentMaxWidth (which assumes a sidebar already ate ~240px).
export const AuthFormMaxWidth = 400
