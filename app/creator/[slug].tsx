import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { getPublicCreatorProfile, type PublicCreatorProfile } from '@/lib/profile'
import { formatCount } from '@/lib/performance'
import { PLATFORM_LABELS } from '@/constants/labels'
import { Colors, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration, staggerDelay } from '@/constants/motion'
import { Mark, Skeleton } from '@/components/ui'
import type { Platform } from '@/types'

/**
 * Public, unauthenticated route — the brand-facing media kit.
 *
 * This is the only screen in the product a brand ever sees, and it is shown
 * mid-negotiation, so it carries more visual weight than anything inside the
 * app. It reads only from the `public_creator_profiles` view (migration 006),
 * which already restricts to opted-in creators and a narrow, safe set of
 * columns — no rates, no client names, no contact details. See app/_layout.tsx
 * for the redirect bypass that keeps it reachable with no session at all.
 */
export default function PublicCreatorProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  // Always dark. This card is a fixed brand statement handed to a third party,
  // not something that should follow the visitor's OS theme.
  const c = Colors.dark

  const [profile, setProfile] = useState<PublicCreatorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    let active = true
    getPublicCreatorProfile(slug)
      .then((data) => {
        if (!active) return
        if (!data) setNotFound(true)
        else setProfile(data)
      })
      .catch(() => active && setNotFound(true))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [slug])

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]}>
        <View style={styles.inner}>
          <Skeleton width={72} height={72} radius={Radius.full} />
          <Skeleton width="60%" height={30} />
          <Skeleton width="35%" height={16} />
          <View style={styles.statsRow}>
            <Skeleton height={82} radius={Radius.lg} />
            <Skeleton height={82} radius={Radius.lg} />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (notFound || !profile) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: c.bgPage }]}>
        <Mark size={56} color={c.textMuted} />
        <Text style={[styles.notFoundTitle, { color: c.textPrimary }]}>Profile not found</Text>
        <Text style={[styles.notFoundSubtitle, { color: c.textSecondary }]}>
          This link may be inactive or no longer shared.
        </Text>
      </SafeAreaView>
    )
  }

  const platforms = (profile.platforms ?? []).filter(Boolean) as Platform[]

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <Animated.View entering={FadeIn.duration(Duration.slower)} style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: c.accent }]}>
              <Text style={styles.avatarText}>
                {profile.name.trim()[0]?.toUpperCase() ?? 'C'}
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(1))}
            style={styles.identity}
          >
            <Text style={[styles.name, { color: c.textPrimary }]}>{profile.name}</Text>
            {profile.niche ? (
              <View style={[styles.nichePill, { backgroundColor: c.accentLight }]}>
                <Text style={[styles.nicheText, { color: c.accentText }]}>{profile.niche}</Text>
              </View>
            ) : null}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(2))}
            style={styles.statsRow}
          >
            {profile.follower_count != null ? (
              <Stat
                value={formatCount(profile.follower_count)}
                label="Followers"
                colors={c}
              />
            ) : null}
            <Stat
              value={String(profile.deals_completed ?? 0)}
              label={profile.deals_completed === 1 ? 'Brand deal' : 'Brand deals'}
              colors={c}
            />
          </Animated.View>

          {platforms.length > 0 ? (
            <Animated.View
              entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(3))}
              style={styles.platformsBlock}
            >
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Creates</Text>
              <View style={styles.platformRow}>
                {platforms.map((platform) => (
                  <View
                    key={platform}
                    style={[styles.platformPill, { borderColor: c.borderStrong }]}
                  >
                    <Text style={[styles.platformText, { color: c.textSecondary }]}>
                      {PLATFORM_LABELS[platform] ?? platform}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          ) : null}
        </View>

        {/* Quiet attribution. A media kit that says where it came from is a
            better advert for the product than anything inside the app. */}
        <Animated.View
          entering={FadeIn.duration(Duration.slower).delay(400)}
          style={styles.footer}
        >
          <Mark size={16} color={c.textMuted} />
          <Text style={[styles.footerText, { color: c.textMuted }]}>
            Always current, from CreatorDesk
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Stat({
  value,
  label,
  colors,
}: {
  value: string
  label: string
  colors: typeof Colors.dark
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.bgSurface }]}>
      <Text style={[styles.statValue, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  inner: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl * 2,
    gap: Spacing.md,
    alignItems: 'center',
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  avatarWrap: {
    marginBottom: Spacing.xs,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.displayBold,
    fontSize: 30,
    color: '#FFFFFF',
  },
  identity: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    fontFamily: FontFamily.displayBold,
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
  },
  nichePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  nicheText: {
    ...Typography.caption,
    fontFamily: FontFamily.semiBold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
    marginTop: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: FontFamily.displayBold,
    fontSize: 26,
  },
  statLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  platformsBlock: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  platformPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  platformText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.xl,
  },
  footerText: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
  notFoundTitle: {
    ...Typography.title,
    fontFamily: FontFamily.display,
    marginTop: Spacing.sm,
  },
  notFoundSubtitle: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
  },
})
