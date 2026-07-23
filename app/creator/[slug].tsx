import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getPublicCreatorProfile, type PublicCreatorProfile } from '@/lib/profile'
import { PLATFORM_LABELS } from '@/constants/labels'
import { Colors, Spacing, Radius, Typography, FontFamily } from '@/constants/design'

// Public, unauthenticated route — a brand-facing media-kit card. Reads only
// from the public_creator_profiles view (migration 006), which already
// restricts to opted-in creators and a narrow, safe set of columns. See
// app/_layout.tsx for the redirect bypass that keeps this route reachable
// with no session at all.
export default function PublicCreatorProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  // Always dark — this card is a fixed brand statement handed to third
  // parties, not something that should follow the visitor's OS theme.
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
      <SafeAreaView style={[styles.centered, { backgroundColor: c.bgPage }]}>
        <ActivityIndicator color={c.textMuted} />
      </SafeAreaView>
    )
  }

  if (notFound || !profile) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: c.bgPage }]}>
        <Text style={[styles.notFoundTitle, { color: c.textPrimary }]}>Profile not found</Text>
        <Text style={[styles.notFoundSubtitle, { color: c.textSecondary }]}>
          This link may be inactive or no longer shared.
        </Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]}>
      <View style={styles.inner}>
        <View style={[styles.logoMark, { backgroundColor: c.accent }]}>
          <Text style={styles.logoMarkText}>{profile.name.trim()[0]?.toUpperCase() ?? 'C'}</Text>
        </View>

        <Text style={[styles.name, { color: c.textPrimary }]}>{profile.name}</Text>
        {profile.niche ? <Text style={[styles.niche, { color: c.accent }]}>{profile.niche}</Text> : null}

        <View style={styles.statsRow}>
          {profile.follower_count != null ? (
            <View style={[styles.statCard, { backgroundColor: c.bgSurface }]}>
              <Text style={[styles.statValue, { color: c.textPrimary }]}>
                {profile.follower_count.toLocaleString('en-IN')}
              </Text>
              <Text style={[styles.statLabel, { color: c.textMuted }]}>Followers</Text>
            </View>
          ) : null}
          <View style={[styles.statCard, { backgroundColor: c.bgSurface }]}>
            <Text style={[styles.statValue, { color: c.textPrimary }]}>{profile.deals_completed}</Text>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>Deals completed</Text>
          </View>
        </View>

        {profile.platforms && profile.platforms.length > 0 ? (
          <View style={styles.platformRow}>
            {profile.platforms.map((p) => (
              <View key={p} style={[styles.platformChip, { borderColor: c.border }]}>
                <Text style={[styles.platformChipText, { color: c.textSecondary }]}>
                  {PLATFORM_LABELS[p] ?? p}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={[styles.watermark, { color: c.textMuted }]}>Made with CreatorDesk</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  inner: {
    flex: 1,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl * 2,
    alignItems: 'center',
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoMarkText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.display,
    fontSize: 24,
  },
  name: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    textAlign: 'center',
  },
  niche: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    width: '100%',
  },
  statCard: {
    flex: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FontFamily.display,
    fontSize: 22,
  },
  statLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    justifyContent: 'center',
  },
  platformChip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  platformChipText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  watermark: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: Spacing.xl * 2,
  },
  notFoundTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  notFoundSubtitle: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
})
