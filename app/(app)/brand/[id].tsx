import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
} from 'react-native'
import { showAlert } from '@/lib/alert'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getBrand, updateBrand } from '@/lib/brands'
import { getDealsForBrand, type DealWithPaymentSummary } from '@/lib/deals'
import { getRatingsForBrand, summarizeRatings } from '@/lib/reputation'
import type { Brand, BrandRating } from '@/types'
import { Colors, Spacing, Radius, Typography, FontFamily, ContentMaxWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { ModalSheet } from '@/components/ModalSheet'
import { DealRow } from '@/components/DealRow'

export default function BrandDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
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

  // brandData/dealsData fetched together (both depend on tables that have
  // existed since migration 001); ratings fetched separately since
  // brand_ratings is a newer table (migration 006) and shouldn't block the
  // rest of the screen if it's not there yet.
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
      showAlert('Error', 'Could not load this brand.')
    } finally {
      setLoading(false)
    }
    try {
      setRatings(await getRatingsForBrand(id))
    } catch {
      // Non-fatal: review history section just doesn't show until this succeeds.
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave() {
    if (!brand || !name.trim()) {
      showAlert('Name required', 'Enter the brand or client name.')
      return
    }
    setSaving(true)
    try {
      await updateBrand(brand.id, {
        name: name.trim(),
        contact_person: contactPerson.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        notes: notes.trim() || null,
      })
      router.back()
    } catch {
      showAlert('Error', 'Could not save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = [
    styles.input,
    { borderColor: c.borderStrong, color: c.textPrimary, backgroundColor: c.bgSurface },
  ]

  const summary = summarizeRatings(ratings)

  if (loading || !brand) {
    return (
      <ModalSheet title="Brand">
        <SafeAreaView style={[styles.centered, { backgroundColor: c.bgPage }]} edges={['bottom']}>
          <ActivityIndicator color={c.textMuted} />
        </SafeAreaView>
      </ModalSheet>
    )
  }

  const saveButton = (
    <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={{ top: 8, bottom: 8, left: 8, right: 0 }}>
      <Text style={[styles.headerSaveText, { color: saving ? c.textMuted : c.textPrimary }]}>
        {saving ? 'Saving…' : 'Save'}
      </Text>
    </TouchableOpacity>
  )

  return (
    <ModalSheet title={brand.name} headerRight={saveButton}>
      <>
        <Stack.Screen options={{ title: brand.name, headerRight: () => saveButton }} />
        <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              contentContainerStyle={[styles.content, isWide && styles.contentWide]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {summary ? (
                <View style={[styles.reputationCard, { backgroundColor: c.accentLight, borderColor: c.accent }]}>
                  <Text style={[styles.reputationScore, { color: c.accent }]}>
                    {summary.averageRating.toFixed(1)} / 5
                  </Text>
                  <Text style={[styles.reputationMeta, { color: c.textSecondary }]}>
                    From {summary.reviewCount} {summary.reviewCount === 1 ? 'review' : 'reviews'}
                    {summary.lastPaidOnTime === false ? ' · Last payment was late' : ''}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Brand name</Text>
              <TextInput style={inputStyle} value={name} onChangeText={setName} autoCapitalize="words" />

              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Contact person</Text>
              <TextInput style={inputStyle} value={contactPerson} onChangeText={setContactPerson} autoCapitalize="words" />

              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Contact phone</Text>
              <TextInput style={inputStyle} value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />

              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Contact email</Text>
              <TextInput
                style={inputStyle}
                value={contactEmail}
                onChangeText={setContactEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Notes</Text>
              <TextInput
                style={[inputStyle, styles.multiline]}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />

              {ratings.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Review history</Text>
                  <View style={{ gap: Spacing.sm }}>
                    {ratings.map((r) => (
                      <View key={r.id} style={[styles.reviewRow, { backgroundColor: c.bgSurface }]}>
                        <View style={styles.reviewHeader}>
                          <Text style={[styles.reviewRating, { color: c.textPrimary }]}>{r.rating} / 5</Text>
                          <Text style={[styles.reviewDate, { color: c.textMuted }]}>
                            {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                        </View>
                        <Text style={[styles.reviewMeta, { color: c.textSecondary }]}>
                          {[
                            r.paid_on_time === false ? 'Paid late' : r.paid_on_time ? 'Paid on time' : null,
                            r.would_work_again === false ? "Wouldn't work again" : r.would_work_again ? 'Would work again' : null,
                            r.revision_rounds != null ? `${r.revision_rounds} revision rounds` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                        {r.notes ? (
                          <Text style={[styles.reviewNotes, { color: c.textSecondary }]}>{r.notes}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
                Deal history ({deals.length})
              </Text>
              {deals.length === 0 ? (
                <Text style={[styles.emptyDeals, { color: c.textMuted }]}>No deals with this brand yet.</Text>
              ) : (
                <View style={{ gap: Spacing.sm }}>
                  {deals.map((deal) => (
                    <DealRow key={deal.id} deal={deal} onPress={() => router.push(`/(app)/deal/${deal.id}` as never)} />
                  ))}
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  contentWide: { maxWidth: ContentMaxWidth, width: '100%', alignSelf: 'center' },
  headerSaveText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
    marginRight: Spacing.md,
  },
  sectionLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  multiline: { height: undefined, minHeight: 80, paddingTop: 11, paddingBottom: 11 },
  reputationCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  reputationScore: {
    fontFamily: FontFamily.display,
    fontSize: 28,
  },
  reputationMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },
  reviewRow: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewRating: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  reviewDate: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  reviewMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  reviewNotes: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: 2,
    lineHeight: 18,
  },
  emptyDeals: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
})
