import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getBrand, updateBrand } from '@/lib/brands'
import { getDealsForBrand, type DealWithPaymentSummary } from '@/lib/deals'
import { getRatingsForBrand, summarizeRatings } from '@/lib/reputation'
import { formatCurrency } from '@/lib/format'
import type { Brand, BrandRating } from '@/types'
import { ContentMaxWidth, FontFamily, Spacing, Typography } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { ModalSheet } from '@/components/ModalSheet'
import { DealRow } from '@/components/DealRow'
import { BrandAvatar } from '@/components/BrandAvatar'
import {
  Button,
  Card,
  Skeleton,
  StarRating,
  TextField,
  useToast,
} from '@/components/ui'

export default function BrandDetailScreen() {
  const toast = useToast()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { c } = useTheme()
  const isWide = useIsWideScreen()

  const [brand, setBrand] = useState<Brand | null>(null)
  const [deals, setDeals] = useState<DealWithPaymentSummary[]>([])
  const [ratings, setRatings] = useState<BrandRating[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()

  // brand/deals fetched together (both depend on tables that have existed since
  // migration 001); ratings fetched separately since brand_ratings is newer
  // (migration 006) and shouldn't block the rest of the screen.
  const load = useCallback(async () => {
    if (!id) return
    try {
      const [brandData, dealsData] = await Promise.all([getBrand(id), getDealsForBrand(id)])
      setBrand(brandData)
      setDeals(dealsData)
      setName(brandData.name)
      setContactPerson(brandData.contact_person ?? '')
      setContactPhone(brandData.contact_phone ?? '')
      setContactEmail(brandData.contact_email ?? '')
      setNotes(brandData.notes ?? '')
    } catch {
      toast('Could not load this brand', { tone: 'error' })
    } finally {
      setLoading(false)
    }
    try {
      setRatings(await getRatingsForBrand(id))
    } catch {
      // Non-fatal: the reputation card just doesn't render until this succeeds.
    }
  }, [id, toast])

  useEffect(() => {
    load()
  }, [load])

  const summary = summarizeRatings(ratings)

  // What this brand is actually worth to her: the answer to "should I say yes
  // again?", which a star rating alone doesn't give.
  const earned = useMemo(
    () =>
      deals
        .filter((deal) => deal.payment?.status === 'paid')
        .reduce((total, deal) => total + (deal.payment?.amount ?? deal.rate), 0),
    [deals]
  )

  async function handleSave() {
    if (!brand) return
    if (!name.trim()) {
      setNameError('Enter the brand or client name')
      return
    }
    setNameError(undefined)

    setSaving(true)
    try {
      await updateBrand(brand.id, {
        name: name.trim(),
        contact_person: contactPerson.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        notes: notes.trim() || null,
      })
      toast('Saved', { tone: 'success' })
      router.back()
    } catch {
      toast('Could not save changes', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ModalSheet title="Brand">
        <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
          <View style={[styles.content, isWide && styles.contentWide]}>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} height={62} />
            ))}
          </View>
        </SafeAreaView>
      </ModalSheet>
    )
  }

  return (
    <ModalSheet title={brand?.name ?? 'Brand'}>
      <Stack.Screen options={{ title: brand?.name ?? 'Brand' }} />
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.content, isWide && styles.contentWide]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Track record first. Before editing a phone number, the useful
                thing is whether this brand is worth working with again. */}
            <Card style={styles.headerCard}>
              <BrandAvatar name={brand?.name ?? '?'} size={48} />
              <View style={styles.headerText}>
                <Text style={[styles.headerName, { color: c.textPrimary }]} numberOfLines={1}>
                  {brand?.name}
                </Text>
                <Text style={[styles.headerMeta, { color: c.textSecondary }]}>
                  {deals.length} {deals.length === 1 ? 'deal' : 'deals'}
                  {earned > 0 ? ` · ${formatCurrency(earned)} paid` : ''}
                </Text>
              </View>
            </Card>

            {summary ? (
              <Card>
                <View style={styles.repRow}>
                  <View style={styles.repText}>
                    <Text style={[styles.repScore, { color: c.textPrimary }]}>
                      {summary.averageRating.toFixed(1)}
                      <Text style={[styles.repOutOf, { color: c.textMuted }]}> / 5</Text>
                    </Text>
                    <Text style={[styles.headerMeta, { color: c.textSecondary }]}>
                      From {summary.reviewCount}{' '}
                      {summary.reviewCount === 1 ? 'review' : 'reviews'}
                    </Text>
                  </View>
                  <StarRating value={Math.round(summary.averageRating)} size={18} readonly />
                </View>

                {summary.lastPaidOnTime === false ? (
                  <View style={[styles.flag, { backgroundColor: c.dangerLight }]}>
                    <Text style={[styles.flagText, { color: c.danger }]}>
                      Their last payment was late. Consider asking for an advance.
                    </Text>
                  </View>
                ) : null}
              </Card>
            ) : null}

            <TextField
              label="Brand"
              value={name}
              onChangeText={(value) => {
                setName(value)
                if (nameError) setNameError(undefined)
              }}
              error={nameError}
              autoCapitalize="words"
            />

            <TextField
              label="POC"
              placeholder="Who you talk to"
              value={contactPerson}
              onChangeText={setContactPerson}
              autoCapitalize="words"
            />

            <TextField
              label="Phone"
              placeholder="+91 98765 43210"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              hint="Used for the one-tap WhatsApp payment nudge"
            />

            <TextField
              label="Email"
              placeholder="poc@brand.com"
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextField
              label="Notes"
              placeholder="Fussy about hook style. Two revision rounds expected."
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <Button
              label="Save"
              onPress={handleSave}
              loading={saving}
              fullWidth
              size="lg"
              style={styles.submit}
            />

            {deals.length > 0 ? (
              <View style={styles.dealsBlock}>
                <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Deals</Text>
                <View style={styles.dealsList}>
                  {deals.map((deal, index) => (
                    <DealRow
                      key={deal.id}
                      deal={deal}
                      index={index}
                      onPress={() => router.push(`/(app)/deal/${deal.id}` as never)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  contentWide: {
    maxWidth: ContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
    gap: Spacing.xxs,
  },
  headerName: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  headerMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  repText: {
    gap: 1,
  },
  repScore: {
    ...Typography.display,
    fontFamily: FontFamily.display,
  },
  repOutOf: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  flag: {
    marginTop: Spacing.md,
    padding: Spacing.sm + 2,
    borderRadius: 10,
  },
  flagText: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    lineHeight: 18,
  },
  submit: {
    marginTop: Spacing.xs,
  },
  dealsBlock: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  dealsList: {
    gap: Spacing.base,
  },
})
