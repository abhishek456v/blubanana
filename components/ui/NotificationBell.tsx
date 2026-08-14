import { useCallback, useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn } from 'react-native-reanimated'
import { getAlertFeed } from '@/lib/alerts'
import { FontFamily, Radius, Typography } from '@/constants/design'
import { Duration } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export interface NotificationBellProps {
  size?: number
  style?: StyleProp<ViewStyle>
}

/**
 * The bell, with a count of what is actually waiting.
 *
 * Refetches on focus rather than polling. The feed is derived from deals plus
 * scheduled reminders, both of which only change through this app, so
 * refreshing when a screen comes forward is enough — a timer would spend
 * requests to learn nothing on a screen nobody is looking at.
 *
 * A zero count renders no badge at all. A grey "0" is a worse signal than
 * silence: it draws the eye to say nothing happened.
 */
export function NotificationBell({ size = 40, style }: NotificationBellProps) {
  const { c } = useTheme()
  const router = useRouter()
  const [count, setCount] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let active = true
      getAlertFeed()
        .then((feed) => {
          if (active) setCount(feed.dueCount)
        })
        // Silent: the bell is ambient. A toast here would fire on every screen
        // the user visits while offline.
        .catch(() => {})
      return () => {
        active = false
      }
    }, [])
  )

  return (
    <PressableScale
      onPress={() => router.push('/(app)/reminders' as never)}
      accessibilityRole="button"
      accessibilityLabel={
        count === 0
          ? 'Reminders, nothing waiting'
          : `Reminders, ${count} waiting`
      }
      style={[
        styles.button,
        { width: size, height: size, backgroundColor: c.bgSurface },
        style,
      ]}
    >
      <Ionicons
        name={count > 0 ? 'notifications' : 'notifications-outline'}
        size={size * 0.45}
        color={count > 0 ? c.accent : c.textPrimary}
      />

      {count > 0 ? (
        <Animated.View
          entering={FadeIn.duration(Duration.base)}
          style={[styles.badge, { backgroundColor: c.danger, borderColor: c.bgPage }]}
        >
          <Text style={styles.badgeText} numberOfLines={1}>
            {count > 9 ? '9+' : count}
          </Text>
        </Animated.View>
      ) : null}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: -1,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: Radius.full,
    // A ring in the page colour, so the badge reads as sitting on top of the
    // bell rather than merging with it against a busy header.
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...Typography.label,
    fontSize: 10,
    lineHeight: 13,
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
  },
})
