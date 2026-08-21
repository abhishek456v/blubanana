import { useCallback, useEffect, useState } from 'react'
import { Image, Linking, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { useEntitlement } from '@/hooks/useEntitlement'
import { FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { Duration } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from '@/components/ui'

interface LiveAnnouncement {
  id: string
  kind: 'news' | 'banner' | 'alert'
  placement: 'bar' | 'popup' | 'image'
  title: string
  body: string | null
  image_url: string | null
  audience: 'everyone' | 'trialing' | 'paying' | 'lapsed'
  link_url: string | null
  link_label: string | null
  dismissible: boolean
}

/** How long each item holds the strip before the next one takes it. */
const ROTATE_MS = 6000

/** Dismissals are per announcement, so a new one is never pre-dismissed. */
const DISMISSED_KEY = 'blubanana.announcements.dismissed'

/**
 * Whatever the admin dashboard is currently broadcasting.
 *
 * Read straight from `announcements` with the ordinary client. The policy only
 * exposes published rows inside their window, so a draft cannot leak here and
 * a banner stops appearing the moment its end date passes, without an app
 * release or anybody remembering.
 *
 * Audience is filtered on the device rather than in the query. The alternative
 * is a policy that reads the caller's subscription on every row, which would
 * make a public table depend on billing state and turn a broadcast into a
 * per-user lookup for the sake of hiding a sentence that is not secret.
 */
export function AnnouncementBanner() {
  const { c } = useTheme()
  const entitlement = useEntitlement()
  const [items, setItems] = useState<LiveAnnouncement[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((raw) => setDismissed(raw ? (JSON.parse(raw) as string[]) : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('announcements')
      .select(
        'id, kind, placement, title, body, image_url, audience, link_url, link_label, dismissible'
      )
      .in('surface', ['app', 'both'])
      .order('sort_order', { ascending: true })
      .order('starts_at', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (cancelled || error) return
        setItems((data ?? []) as LiveAnnouncement[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = useCallback(
    async (id: string) => {
      const next = [...dismissed, id]
      setDismissed(next)
      await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(next)).catch(() => {})
    },
    [dismissed]
  )

  // `canWrite` is the field that actually means "covered", and it fails open,
  // so a network blip shows somebody the everyone message rather than the
  // lapsed one. That is the right way round to be wrong.
  const matchesAudience = (a: LiveAnnouncement) => {
    if (a.audience === 'everyone') return true
    if (a.audience === 'trialing') return entitlement.isTrialing
    if (a.audience === 'paying') return entitlement.canWrite && !entitlement.isTrialing
    return !entitlement.canWrite
  }

  // `popup` has no app surface yet, so it is excluded rather than falling
  // through and appearing as a line of text it was never written to be.
  const eligible = items.filter(
    (a) => a.placement !== 'popup' && !dismissed.includes(a.id) && matchesAudience(a)
  )

  /*
   * One at a time, taking turns.
   *
   * Two banners stacked is how a product starts looking like it is shouting,
   * and the second never gets read. The website runs its items past in a
   * strip; a phone has no room for that, so they take turns in place instead.
   */
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (eligible.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % eligible.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [eligible.length])

  // Dismissing the last one leaves `index` past the end of a shorter list.
  const shown = eligible[index % Math.max(eligible.length, 1)]
  if (!shown) return null

  const tone =
    shown.kind === 'alert'
      ? { bg: c.dangerLight, fg: c.danger, icon: 'alert-circle' as const }
      : shown.kind === 'news'
        ? { bg: c.bgSurface, fg: c.textSecondary, icon: 'information-circle-outline' as const }
        : { bg: c.accentLight, fg: c.accentText, icon: 'megaphone-outline' as const }

  const open = () => {
    if (shown.link_url) Linking.openURL(shown.link_url).catch(() => {})
  }

  if (shown.placement === 'image' && shown.image_url) {
    return (
      <Animated.View entering={FadeInDown.duration(Duration.base)} key={shown.id}>
        <PressableScale
          onPress={shown.link_url ? open : undefined}
          disabled={!shown.link_url}
          accessibilityRole={shown.link_url ? 'link' : 'image'}
          // The title is the alt text. A picture with nothing to announce it is
          // silence to anybody using a screen reader.
          accessibilityLabel={shown.title}
          style={styles.imageWrap}
        >
          <Image
            source={{ uri: shown.image_url }}
            style={styles.image}
            resizeMode="cover"
            accessible={false}
          />
          {shown.dismissible ? (
            <PressableScale
              onPress={() => dismiss(shown.id)}
              hitSlop={HitSlop}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              style={styles.imageClose}
            >
              <Ionicons name="close" size={15} color="#FFFFFF" />
            </PressableScale>
          ) : null}
        </PressableScale>
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeInDown.duration(Duration.base)} key={shown.id}>
      <PressableScale
        onPress={shown.link_url ? open : undefined}
        disabled={!shown.link_url}
        accessibilityRole={shown.link_url ? 'link' : undefined}
        accessibilityLabel={shown.title}
        style={[styles.bar, { backgroundColor: tone.bg }]}
      >
        <Ionicons name={tone.icon} size={17} color={tone.fg} />
        <View style={styles.text}>
          <Text style={[styles.title, { color: tone.fg }]} numberOfLines={2}>
            {shown.title}
          </Text>
          {shown.body ? (
            <Text style={[styles.body, { color: tone.fg }]} numberOfLines={3}>
              {shown.body}
            </Text>
          ) : null}
          {shown.link_url && shown.link_label ? (
            <Text style={[styles.link, { color: tone.fg }]}>{shown.link_label} →</Text>
          ) : null}
        </View>
        {shown.dismissible ? (
          <PressableScale
            onPress={() => dismiss(shown.id)}
            hitSlop={HitSlop}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Ionicons name="close" size={16} color={tone.fg} />
          </PressableScale>
        ) : null}
      </PressableScale>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  imageWrap: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 132 },
  imageClose: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    // Its own scrim, because the picture behind it is unknown and a white
    // cross on a white photograph is not a control.
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  text: { flex: 1, gap: 2 },
  title: { ...Typography.caption, fontFamily: FontFamily.semiBold, lineHeight: 18 },
  body: { ...Typography.caption, fontFamily: FontFamily.regular, lineHeight: 18 },
  link: { ...Typography.label, fontFamily: FontFamily.semiBold, marginTop: 2 },
})
