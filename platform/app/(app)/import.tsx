import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { File } from 'expo-file-system'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import {
  extractDealsFromImage,
  extractDealsFromText,
  importDeals,
  type ImportCandidate,
} from '@/lib/importDeals'
import { formatCurrency, formatDate } from '@/lib/format'
import { TRIAL_DEAL_LIMIT } from '@/lib/subscription'
import { ContentMaxWidth, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { ModalSheet } from '@/components/ModalSheet'
import {
  Button,
  EmptyState,
  PressableScale,
  RevealScrollView,
  Skeleton,
  useToast,
} from '@/components/ui'

type Stage = 'pick' | 'reading' | 'review' | 'importing' | 'done'

/**
 * Bringing in the deals a creator already has (§8.2).
 *
 * The reason this exists, stated plainly in the spec: "a creator arriving has
 * live deals already. If day one is 'type in all eight', she leaves."
 *
 * The review step is not a formality. Every AI path in this app shows its work
 * before saving (§8.3), and this one has the most to get wrong — a
 * misread column turns into eight deals with the wrong money in them, and
 * unpicking that by hand is worse than never importing.
 */
export default function ImportScreen() {
  const { c } = useTheme()
  const toast = useToast()

  const [stage, setStage] = useState<Stage>('pick')
  const [candidates, setCandidates] = useState<ImportCandidate[]>([])
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<
    { imported: number; failed: number; hitTrialLimit: boolean } | null
  >(null)

  const chosen = candidates.filter((candidate) => !skipped.has(candidate.key))

  function toggle(key: string) {
    setSkipped((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleReceive(promise: Promise<ImportCandidate[]>) {
    setStage('reading')
    try {
      const found = await promise
      if (found.length === 0) {
        toast('No deals found in that file', { tone: 'warning' })
        setStage('pick')
        return
      }
      setCandidates(found)
      setSkipped(new Set())
      setStage('review')
    } catch {
      toast('Could not read that file', { tone: 'error' })
      setStage('pick')
    }
  }

  async function handlePickFile() {
    const picked = await DocumentPicker.getDocumentAsync({
      // Spreadsheets are exported as CSV far more often than they are shared as
      // .xlsx, and CSV is the one a model can read without a parser.
      type: ['text/csv', 'text/plain', 'text/*', 'application/csv'],
      copyToCacheDirectory: true,
    })
    if (picked.canceled || !picked.assets[0]) return

    try {
      const text = new File(picked.assets[0].uri).textSync()
      await handleReceive(extractDealsFromText(text))
    } catch {
      toast('Could not open that file', { tone: 'error' })
    }
  }

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      toast('Photo access is needed to read a screenshot', { tone: 'warning' })
      return
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      base64: true,
    })
    if (picked.canceled || !picked.assets[0]?.base64) return

    await handleReceive(
      extractDealsFromImage(picked.assets[0].base64, picked.assets[0].mimeType ?? 'image/jpeg')
    )
  }

  async function handleImport() {
    setStage('importing')
    try {
      const outcome = await importDeals(chosen)
      setResult({
        imported: outcome.imported,
        failed: outcome.failed.length,
        // Distinguished because it is not a failure she can retry away: the
        // trial simply ran out of room, and the fix is a subscription.
        hitTrialLimit: outcome.failed.some((f) => /Trial limit/i.test(f.reason)),
      })
      setStage('done')
    } catch {
      toast('Could not import those deals', { tone: 'error' })
      setStage('review')
    }
  }

  return (
    <ModalSheet title="Import deals">
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <RevealScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {stage === 'pick' ? (
            <>
              <Text style={[styles.intro, { color: c.textSecondary }]}>
                Already tracking your deals somewhere? Point this at it and they come
                across: a spreadsheet export, or a photo of your notes. You review
                everything before anything is saved.
              </Text>

              <PressableScale
                onPress={handlePickFile}
                accessibilityRole="button"
                accessibilityLabel="Choose a spreadsheet or CSV"
                style={[styles.option, { backgroundColor: c.bgSurface }]}
              >
                <View style={[styles.optionIcon, { backgroundColor: c.accentLight }]}>
                  <Ionicons name="document-text" size={20} color={c.accent} />
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: c.textPrimary }]}>
                    A spreadsheet or CSV
                  </Text>
                  <Text style={[styles.optionHint, { color: c.textMuted }]}>
                    Exported from Google Sheets, Excel or Notion
                  </Text>
                </View>
              </PressableScale>

              <PressableScale
                onPress={handlePickImage}
                accessibilityRole="button"
                accessibilityLabel="Choose a screenshot"
                style={[styles.option, { backgroundColor: c.bgSurface }]}
              >
                <View style={[styles.optionIcon, { backgroundColor: c.accentLight }]}>
                  <Ionicons name="image" size={20} color={c.accent} />
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: c.textPrimary }]}>
                    A screenshot or photo
                  </Text>
                  <Text style={[styles.optionHint, { color: c.textMuted }]}>
                    Your notes app, a diary page, a WhatsApp list
                  </Text>
                </View>
              </PressableScale>
            </>
          ) : null}

          {stage === 'reading' || stage === 'importing' ? (
            <>
              <Text style={[styles.intro, { color: c.textSecondary }]}>
                {stage === 'reading' ? 'Reading your deals…' : 'Saving them…'}
              </Text>
              <Skeleton height={72} radius={Radius.lg} />
              <Skeleton height={72} radius={Radius.lg} />
              <Skeleton height={72} radius={Radius.lg} />
            </>
          ) : null}

          {stage === 'review' ? (
            <>
              <Text style={[styles.intro, { color: c.textSecondary }]}>
                Found {candidates.length} {candidates.length === 1 ? 'deal' : 'deals'}. Tap any you
                do not want. Anything missing can be filled in afterwards on the deal itself.
              </Text>

              {candidates.map((candidate) => {
                const off = skipped.has(candidate.key)
                return (
                  <PressableScale
                    key={candidate.key}
                    onPress={() => toggle(candidate.key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !off }}
                    accessibilityLabel={candidate.brand_name ?? 'Unnamed brand'}
                    style={[
                      styles.row,
                      { backgroundColor: c.bgSurface, opacity: off ? 0.42 : 1 },
                    ]}
                  >
                    <Ionicons
                      name={off ? 'ellipse-outline' : 'checkmark-circle'}
                      size={22}
                      color={off ? c.textMuted : c.accent}
                    />
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: c.textPrimary }]} numberOfLines={1}>
                        {candidate.brand_name ?? 'Unnamed brand'}
                        {candidate.existingBrandId ? ' · existing brand' : ''}
                      </Text>
                      <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={2}>
                        {[
                          candidate.deliverable_description,
                          candidate.rate ? formatCurrency(candidate.rate) : 'no rate found',
                          candidate.publish_date ? formatDate(candidate.publish_date) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  </PressableScale>
                )
              })}

              <Button
                label={
                  chosen.length === 0
                    ? 'Nothing selected'
                    : `Import ${chosen.length} ${chosen.length === 1 ? 'deal' : 'deals'}`
                }
                onPress={handleImport}
                disabled={chosen.length === 0}
                fullWidth
              />
              <Button label="Start over" variant="ghost" onPress={() => setStage('pick')} fullWidth />
            </>
          ) : null}

          {stage === 'done' && result ? (
            <EmptyState
              icon="checkmark-circle-outline"
              title={`${result.imported} ${result.imported === 1 ? 'deal' : 'deals'} imported`}
              message={
                result.hitTrialLimit
                  ? `Your trial covers ${TRIAL_DEAL_LIMIT} deals, so ${result.failed} could not come across yet. Subscribe and import the rest; nothing is lost.`
                  : result.failed > 0
                    ? `${result.failed} could not be saved and were left out. Everything else is on your dashboard, with its deadlines and reminders already set.`
                    : 'They are on your dashboard now, with their deadlines and reminders already set.'
              }
            />
          ) : null}
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
  intro: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    lineHeight: 21,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  optionHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  rowMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 17,
  },
})
