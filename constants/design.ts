// Design tokens from DESIGN.md — always pull from here, never hardcode values.

export const Colors = {
  light: {
    bgPage: '#FFFFFF',
    bgSurface: '#F7F7F7',
    bgSurfaceRaised: '#FFFFFF',
    border: '#E5E5E5',
    borderStrong: '#D0D0D0',
    textPrimary: '#0A0A0A',
    textSecondary: '#6B6B6B',
    textMuted: '#9E9E9E',
    fillPrimary: '#0A0A0A',
    onFillPrimary: '#FFFFFF',
  },
  dark: {
    bgPage: '#000000',
    bgSurface: '#121212',
    bgSurfaceRaised: '#1C1C1C',
    border: '#2A2A2A',
    borderStrong: '#3A3A3A',
    textPrimary: '#FAFAFA',
    textSecondary: '#A0A0A0',
    textMuted: '#6E6E6E',
    fillPrimary: '#FAFAFA',
    onFillPrimary: '#0A0A0A',
  },
} as const

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
} as const
