import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/core'
import { cardIsThin, getProfileCardData, type ProfileCardData } from '@/lib/profileCard'
import { buildProfileCardHtml } from '@/lib/profileCardHtml'
import { sharePdf } from '@/lib/sharePdf'
import { formatCurrency } from '@/lib/format'
import { ContentMaxWidth, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { ModalSheet } from '@/components/ModalSheet'
import {
  Button,
  EmptyState,
  Figure,
  GradientCard,
  RevealScrollView,
  Skeleton,
  useToast,
} from '@/components/ui'

/** `1.2M` / `48.3K` — mirrors the card itself so the preview cannot disagree. */
function compactCount(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1).replace(/\.0$/, '')}Cr`
  if (n >= 100_000) return `${(n / 100_000).toFixed(1).replace(/\.0$/, '')}L`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

/**
 * The shareable card (§8.11) — what a creator sends when a brand says "share
 * your commercials".
 *
 * Nothing here is a field she fills in. The rates are the median of what she
 * has actually charged per deliverable, drawn from her own history, because a
 * card assembled by hand goes stale within weeks and a stale card sent to a
 * brand is worse than none.
 *
 * The preview is native and the shared artefact is the HTML in
 * `profileCardHtml.ts`. Two renderings of one dataset is a real risk — they can
 * drift — so the preview deliberately shows the same figures in the same order
 * rather than being a second design.
 */
export default function ProfileCardScreen() {
  const { c } = useTheme()
  const toast = useToast()

  const [data, setData] = useState<ProfileCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await getProfileCardData())
    } catch {
      toast('Could not build your card', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  async function handleShare() {
    if (!data || sharing) return
    setSharing(true)
    try {
      await sharePdf(buildProfileCardHtml(data), 'Rate card')
    } catch {
      toast('Could not share your card', { tone: 'error' })
    } finally {
      setSharing(false)
    }
  }

  return (
    <ModalSheet title="Rate card">
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <RevealScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <Skeleton height={220} radius={Radius.lg} />
          ) : !data || cardIsThin(data) ? (
            <EmptyState
              icon="id-card-outline"
              title="Not enough history yet"
              message="Your rate card is built from what you have actually charged. Log a few deals with their line items and it fills itself in."
            />
          ) : (
            <>
              {/* Front */}
              <GradientCard gradient="blue" style={styles.card}>
                <Text style={styles.name}>{data.name}</Text>
                {data.niche ? <Text style={styles.niche}>{data.niche}</Text> : null}
                {data.handles.length > 0 ? (
                  <Text style={styles.handles}>
                    {data.handles.map((h) => `@${h.handle}`).join('  ·  ')}
                  </Text>
                ) : null}

                <View style={styles.stats}>
                  {data.followers != null ? (
                    <View>
                      <Figure value={compactCount(data.followers)} size="lg" color="#FFFFFF" bold />
                      <Text style={styles.statLabel}>Followers</Text>
                    </View>
                  ) : null}
                  {data.engagementRate != null ? (
                    <View>
                      <Figure
                        value={`${(data.engagementRate * 100).toFixed(1)}%`}
                        size="lg"
                        color="#FFFFFF"
                        bold
                      />
                      <Text style={styles.statLabel}>Engagement</Text>
                    </View>
                  ) : null}
                  {data.costPerView != null ? (
                    <View>
                      <Figure
                        value={`₹${data.costPerView.toFixed(2)}`}
                        size="lg"
                        color="#FFFFFF"
                        bold
                      />
                      <Text style={styles.statLabel}>Cost per view</Text>
                    </View>
                  ) : null}
                </View>
              </GradientCard>

              {/* Back */}
              <GradientCard gradient="ink" style={styles.card}>
                <Text style={styles.sectionLabel}>Rates</Text>
                {data.rates.map((rate) => (
                  <View key={rate.kind} style={styles.rateRow}>
                    <Text style={styles.rateLabel}>{rate.label}</Text>
                    <Text style={styles.rateValue}>{formatCurrency(rate.typical)}</Text>
                  </View>
                ))}
                {data.phone ? (
                  <>
                    <Text style={[styles.sectionLabel, styles.contactLabel]}>Contact</Text>
                    <Text style={styles.contact}>{data.phone}</Text>
                  </>
                ) : null}
              </GradientCard>

              {/* Said here rather than on the card. A brand reading the card
                  does not need to be told how the sausage is made; the creator
                  does, because it is what makes the number defensible. */}
              <Text style={[styles.note, { color: c.textMuted }]}>
                Each rate is the median of what you have actually charged for that
                deliverable — not a list price. It updates itself as you log deals.
              </Text>

              {data.costPerView == null ? (
                <Text style={[styles.note, { color: c.textMuted }]}>
                  Cost per view appears once your deals carry view counts. Add them on a
                  deal&apos;s line items.
                </Text>
              ) : null}

              {!data.statsAreLive ? (
                <Text style={[styles.note, { color: c.textMuted }]}>
                  Follower and engagement figures are the ones you entered. They refresh
                  themselves once Instagram and YouTube are connected.
                </Text>
              ) : null}

              <Button
                label={sharing ? 'Preparing…' : 'Share card'}
                onPress={handleShare}
                disabled={sharing}
                fullWidth
              />
            </>
          )}
        </RevealScrollView>
      </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
    maxWidth: ContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  name: {
    ...Typography.title,
    fontFamily: FontFamily.display,
    color: '#FFFFFF',
  },
  niche: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.72)',
  },
  handles: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.88)',
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  statLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.62)',
    marginTop: 2,
  },
  sectionLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.52)',
  },
  contactLabel: {
    marginTop: Spacing.md,
  },
  contact: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.9)',
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  rateLabel: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.86)',
  },
  rateValue: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
  },
  note: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
})
