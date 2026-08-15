import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { Duration } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export interface HeaderAction {
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  /** Screen-reader label. Required, since these are icon-only buttons. */
  label: string
  /** Fills the button with the accent. Use for the one primary action. */
  primary?: boolean
}

export interface ScreenHeaderProps {
  title: string
  /** One short line under the title. Keep it to a sentence. */
  subtitle?: string
  /** Small uppercase-free label above the title: "Tuesday", "FY 2026-27". */
  eyebrow?: string
  actions?: HeaderAction[]
  /**
   * Rendered alongside `actions`, for a control that owns its own rendering
   * rather than being an icon button: the theme toggle, an avatar.
   */
  leadingAction?: ReactNode
  /**
   * Shows a back chevron above the title. For pushed screens that turn the
   * native header off. Without it they are a dead end on desktop, where
   * there is no OS back gesture and the sidebar is not on screen.
   */
  onBack?: () => void
  /** Text beside the back chevron: where the user came from. */
  backLabel?: string
  /** Rendered under the title block: a search field, filter row, metrics. */
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * Large-title screen header.
 *
 * The tab screens turn off the native navigation header and use this instead.
 * Two reasons: the native header caps out at a single small centred title,
 * where DESIGN.md §2 wants the display face at 28px doing the talking; and a
 * header that scrolls with the content lets the first screenful be the
 * creator's numbers rather than a chrome bar.
 */
export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  leadingAction,
  onBack,
  backLabel = 'Back',
  children,
  style,
}: ScreenHeaderProps) {
  const { c } = useTheme()

  return (
    <Animated.View entering={FadeInDown.duration(Duration.slow)} style={[styles.container, style]}>
      {onBack ? (
        <PressableScale
          onPress={onBack}
          style={styles.back}
          hitSlop={HitSlop}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <Ionicons name="chevron-back" size={17} color={c.textSecondary} />
          <Text style={[styles.backLabel, { color: c.textSecondary }]}>{backLabel}</Text>
        </PressableScale>
      ) : null}

      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          {eyebrow ? (
            <Text style={[styles.eyebrow, { color: c.textMuted }]} numberOfLines={1}>
              {eyebrow}
            </Text>
          ) : null}
          <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {actions?.length || leadingAction ? (
          <View style={styles.actions}>
            {leadingAction}
            {actions?.map((action) => (
              <PressableScale
                key={action.label}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: action.primary ? c.fillPrimary : c.bgSurface,
                  },
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={action.primary ? c.onFillPrimary : c.textPrimary}
                />
              </PressableScale>
            ))}
          </View>
        ) : null}
      </View>

      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    // Pulls the chevron's optical left edge in line with the title's stem
    // rather than its glyph box.
    marginLeft: -4,
    marginBottom: -6,
    alignSelf: 'flex-start',
  },
  backLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.xxs,
  },
  eyebrow: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  title: {
    ...Typography.display,
    fontFamily: FontFamily.display,
  },
  subtitle: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    // Nudges the buttons onto the same optical line as the title's cap height.
    marginTop: 4,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
