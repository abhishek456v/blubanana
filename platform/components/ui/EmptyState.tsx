import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { Button } from './Button'

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  message?: string
  actionLabel?: string
  onAction?: () => void
  style?: StyleProp<ViewStyle>
}

/**
 * Empty and no-results states.
 *
 * The previous version of these was two lines of centred text. An empty
 * dashboard is the very first thing a new creator sees, so it gets the
 * display face, a tinted icon and, critically, the action that resolves it,
 * rather than prose telling the user where to look for a button.
 */
export function EmptyState({ icon, title, message, actionLabel, onAction, style }: EmptyStateProps) {
  const { c } = useTheme()

  return (
    <Animated.View entering={FadeInDown.duration(Duration.slow)} style={[styles.container, style]}>
      {icon ? (
        <View style={[styles.iconCircle, { backgroundColor: c.accentLight }]}>
          <Ionicons name={icon} size={26} color={c.accent} />
        </View>
      ) : null}

      <Text style={[styles.title, { color: c.textPrimary }]}>{title}</Text>

      {message ? (
        <Text style={[styles.message, { color: c.textSecondary }]}>{message}</Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: Spacing.xl * 2,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.display,
    fontSize: 22,
    fontFamily: FontFamily.display,
    textAlign: 'center',
  },
  message: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  action: {
    marginTop: Spacing.md,
    alignSelf: 'center',
  },
})
