// Design tokens from DESIGN.md — always pull from here, never hardcode values.

// `bgContrast` is the one that makes the dashboard look designed rather than
// flat: a card that inverts against the page — near-black on the light theme,
// cream on the dark one. Used for the single most important figure on a screen.
//
// Exactly one contrast card per screen. Two competing for attention means
// neither has it, which is the failure mode this token invites if unwatched.
export const Colors = {
  light: {
    bgPage: '#FDFBF9',
    bgSurface: '#F6F2EC',
    bgSurfaceRaised: '#FFFFFF',
    bgContrast: '#1C1815',
    onContrast: '#F5F0E8',
    onContrastMuted: 'rgba(245,240,232,0.62)',
    // Hairlines, ghost-button fills and chart tracks *on* the contrast card.
    // The page's `border` token is derived from the page ground, so on an
    // inverted card it is invisible in one theme and glaring in the other.
    onContrastFaint: 'rgba(245,240,232,0.15)',
    border: 'rgba(20,18,16,0.08)',
    borderStrong: 'rgba(20,18,16,0.16)',
    textPrimary: '#1C1815',
    textSecondary: '#585049',
    textMuted: '#756E66',
    fillPrimary: '#F5A623',
    onFillPrimary: '#FFFFFF',
    accent: '#F5A623',
    // Amber as *text*. The brand amber is 1.96:1 on the page — unreadable —
    // so anywhere the accent carries words rather than fills a shape, it is
    // darkened to clear AA. Fills, icons on tinted grounds, chart bars and
    // borders keep `accent`.
    accentText: '#956515',
    accentLight: 'rgba(245,166,35,0.12)',
    // Between `accentLight` (a tint you put text on) and `accent` (the thing
    // itself). Chart bars need this: at 12% alpha a bar reads as a loading
    // skeleton rather than as data.
    accentSoft: 'rgba(245,166,35,0.42)',
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
    // Inverts the other way: on a dark page the attention-grabbing card is the
    // pale one. Same role, opposite value.
    bgContrast: '#F5F0E8',
    onContrast: '#1C1815',
    onContrastMuted: 'rgba(28,24,21,0.62)',
    onContrastFaint: 'rgba(28,24,21,0.13)',
    border: 'rgba(255,255,255,0.07)',
    borderStrong: 'rgba(255,255,255,0.16)',
    textPrimary: '#F5F0E8',
    textSecondary: '#BAB3AA',
    textMuted: '#948E87',
    fillPrimary: '#F5A623',
    onFillPrimary: '#FFFFFF',
    accent: '#F5A623',
    // On a dark ground the brand amber already clears AA (9.2:1), so the text
    // variant is the accent itself — the token exists so screens can use one
    // name in both themes.
    accentText: '#F5A623',
    accentLight: 'rgba(245,166,35,0.14)',
    // Higher than the light theme's: an amber at 46% over a near-black ground
    // reads olive, not amber.
    accentSoft: 'rgba(245,166,35,0.58)',
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
// Three tiers, not two.
//
// A single `wide` breakpoint treated a 1440px laptop exactly like a 768px
// tablet: one narrow column, centred, with the rest of the window left empty.
// It read as a phone screenshot pasted into a browser, because that is
// effectively what it was.
//
//   mobile  (<768)      bottom tabs, single column, edge-to-edge
//   wide    (768–1179)  sidebar appears, content still one column
//   desktop (>=1180)    content spreads: metrics in a row, two-column body
export const Breakpoints = {
  wide: 768,
  desktop: 1180,
} as const

export const SidebarWidth = 240

// Caps how wide a single column of text or form inputs gets. Reading line
// length, not screen width, is what sets this — beyond roughly this, the eye
// loses the start of the next line.
export const ContentMaxWidth = 720

/**
 * Cap for a desktop page that lays out in columns rather than one stack.
 *
 * Wider than ContentMaxWidth because the constraint there — line length — does
 * not apply once content is arranged side by side. On a 1440px laptop this
 * leaves the sidebar plus ~1160px of used space instead of a 720px column
 * floating in the middle of it.
 */
export const DesktopContentMaxWidth = 1160

/** Gap between columns in a desktop two-column body. */
export const ColumnGap = 20

// Sign-in/sign-up have no sidebar to sit next to — they're centered,
// standalone screens — so they get their own, narrower cap instead of
// ContentMaxWidth (which assumes a sidebar already ate ~240px).
export const AuthFormMaxWidth = 400

// ---------------------------------------------------------------------------
// Elevation
//
// DESIGN.md §5 rules out decorative shadow effects, so these exist only to
// establish *layer order* — what sits above what. Values are deliberately low
// and warm-tinted (pure black shadow over a warm palette reads grey and
// cheap). Dark mode leans on a heavier, tighter shadow because a light-on-
// dark surface separates by luminance far less than the reverse.
//
// Each entry carries both the iOS/web shadow* properties and Android's
// `elevation`, so one spread covers all three platforms.
// ---------------------------------------------------------------------------

const shadow = (
  color: string,
  opacity: number,
  radius: number,
  offsetY: number,
  androidElevation: number
) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: offsetY },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation: androidElevation,
})

export const Elevation = {
  light: {
    /** Raised rows and cards that need to lift off the page a little. */
    sm: shadow('#2A1F14', 0.05, 6, 2, 2),
    /** Sheets, popovers, floating panels. */
    md: shadow('#2A1F14', 0.1, 20, 8, 8),
    /** The one thing floating above everything (FAB, toast). */
    lg: shadow('#2A1F14', 0.16, 32, 14, 16),
  },
  dark: {
    sm: shadow('#000000', 0.3, 6, 2, 2),
    md: shadow('#000000', 0.45, 20, 8, 8),
    lg: shadow('#000000', 0.6, 32, 14, 16),
  },
} as const

/**
 * The "soft accent glow" DESIGN.md §5 allows on primary buttons and hero
 * elements. Not a drop shadow — an amber halo, so a filled button reads as
 * lit rather than as a card sitting on the page.
 */
export const accentGlow = (opacity = 0.35) =>
  shadow(Colors.light.accent, opacity, 16, 4, 0)

/** Standard touch expansion for small icon-only controls (close, dismiss). */
export const HitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const
