import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BrandHasDeals, deleteBrand, getBrand, updateBrand } from '@/lib/brands'
import { getContacts, replaceContacts, type ContactDraft } from '@/lib/brandContacts'
import { ContactsEditor } from '@/components/brand/ContactsEditor'
import { getDealsForBrand, paymentsInOrder, type DealWithPaymentSummary } from '@/lib/deals'
import { getRatingsForBrand, summarizeRatings } from '@/lib/reputation'
import { formatCurrency } from '@/lib/format'
import type { Brand, BrandRating } from '@/types'
import { FontFamily, Spacing, Typography } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { ModalSheet } from '@/components/ModalSheet'
import { DealRow } from '@/components/DealRow'
import { BrandAvatar } from '@/components/BrandAvatar'
import {
  Button,
  Card,
  OverflowMenu,
  Skeleton,
  StarRating,
  TextField,
  useConfirm,
  useToast,
} from '@/components/ui'

export default function BrandDetailScreen() {
  const toast = useToast()
  const confirm = useConfirm()
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
  const [contactDrafts, setContactDrafts] = useState<ContactDraft[]>([])
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
      const existing = await getContacts(brandData.id)
      setContactDrafts(
        existing.map((contact) => ({
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          role: contact.role,
          is_primary: contact.is_primary,
        }))
      )
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
        .flatMap((deal) => paymentsInOrder(deal))
        .filter((payment) => payment.status === 'paid')
        .reduce((total, payment) => total + (payment.amount_received ?? payment.amount), 0),
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
        notes: notes.trim() || null,
      })

      await replaceContacts(brand.id, contactDrafts)
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

  async function handleDelete() {
    if (!brand) return
    const ok = await confirm({
      title: `Delete ${brand.name}?`,
      message:
        'Their contacts go too. Deals are never touched: if any still point at this brand, the delete is refused rather than taking a year of work with it.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return

    try {
      await deleteBrand(brand.id)
      toast(`${brand.name} deleted`, { tone: 'neutral' })
      router.back()
    } catch (error) {
      console.error('deleteBrand failed', error)
      toast(
        error instanceof BrandHasDeals
          ? 'This brand still has deals. Delete or reassign those first.'
          : 'Could not delete that brand',
        { tone: 'error' }
      )
    }
  }

  const menu = (
    <OverflowMenu
      subject={brand?.name || 'Brand'}
      actions={[{ label: 'Delete brand', icon: 'trash-outline', onPress: handleDelete, destructive: true }]}
    />
  )

  // Track record first. Before editing a phone number, the useful thing is
  // whether this brand is worth working with again.
  const headerCard = (
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
  )

  const reputation = summary ? (
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
  ) : null

  const form = (
    <>
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

    {/* Several contacts, one of them primary (migration 019). A brand
        used to hold exactly one name, phone and email, and agency
        contacts change often enough that chasing the old one is how a
        payment quietly stops arriving. */}
    <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Contacts</Text>
    <ContactsEditor contacts={contactDrafts} onChange={setContactDrafts} />

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
    </>
  )

  const dealsBlock = deals.length > 0 ? (
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
  ) : null

  return (
    <ModalSheet title={brand?.name ?? 'Brand'} headerRight={menu} wide>
      <Stack.Screen options={{ title: brand?.name ?? 'Brand', headerRight: () => menu }} />
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
            {headerCard}
            {isWide ? (
              // Editing the brand and reading its history are two jobs. Side by
              // side, changing a contact no longer scrolls the payment record
              // and the late-payment flag off the screen.
              <View style={styles.columns}>
                <View style={styles.column}>{form}</View>
                <View style={styles.column}>
                  {reputation}
                  {dealsBlock}
                </View>
              </View>
            ) : (
              <>
                {reputation}
                {form}
                {dealsBlock}
              </>
            )}
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
    padding: Spacing.lg,
    width: '100%',
    alignSelf: 'center',
  },
  columns: {
    flexDirection: 'row',
    gap: Spacing.lg,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    gap: Spacing.md,
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
  sectionLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.sm,
  },
  dealsList: {
    gap: Spacing.base,
  },
})
