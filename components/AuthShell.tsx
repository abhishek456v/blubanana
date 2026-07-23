import type { ReactNode } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing, Radius, FontFamily } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'

const BENEFITS = ['Never miss a deal', 'Never miss a deadline', 'Never miss a payment']

// Wraps every (auth) screen. On wide viewports it adds a branded left panel
// next to the form — the panel always uses the dark palette regardless of
// the device's light/dark setting, since it's a fixed brand statement, not
// content that should follow the reader's theme (same pattern as most SaaS
// login pages). Below the wide breakpoint it's a pure passthrough.
export function AuthShell({ children }: { children: ReactNode }) {
  const isWide = useIsWideScreen()
  const dark = Colors.dark

  if (!isWide) return <>{children}</>

  return (
    <View style={styles.row}>
      <View style={[styles.brandPanel, { backgroundColor: dark.bgPage }]}>
        <View style={[styles.glow, { backgroundColor: dark.accentLight }]} />
        <View style={styles.brandTop}>
          <View style={[styles.logoMark, { backgroundColor: dark.accent }]}>
            <Text style={styles.logoMarkText}>C</Text>
          </View>
          <Text style={[styles.logoWord, { color: dark.textPrimary }]}>CreatorDesk</Text>
        </View>

        <View>
          <Text style={[styles.headline, { color: dark.textPrimary }]}>
            Your deals.{'\n'}
            <Text style={{ color: dark.accent }}>Your payments.</Text>
            {'\n'}Your business.
          </Text>
          <Text style={[styles.subtext, { color: dark.textSecondary }]}>
            Everything a creator needs to run their brand collaborations, in one place.
          </Text>
        </View>

        <View style={styles.chipRow}>
          {BENEFITS.map((benefit) => (
            <View key={benefit} style={[styles.chip, { borderColor: dark.border }]}>
              <Text style={[styles.chipText, { color: dark.textSecondary }]}>{benefit}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.formPanel}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  brandPanel: {
    flex: 1,
    maxWidth: 480,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl * 1.5,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -140,
    right: -140,
    width: 360,
    height: 360,
    borderRadius: 360,
  },
  brandTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.display,
    fontSize: 16,
  },
  logoWord: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  headline: {
    fontFamily: FontFamily.display,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  subtext: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: Spacing.md,
    maxWidth: 320,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
  },
  formPanel: {
    flex: 1,
  },
})
