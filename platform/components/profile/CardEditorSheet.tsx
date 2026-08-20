import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { CardContent } from '@/lib/profileCardHtml'
import type { RateSuggestion } from '@/lib/profileCard'
import { FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { Button, PressableScale, Sheet, TextField } from '@/components/ui'

export interface CardEditorSheetProps {
  visible: boolean
  content: CardContent
  onClose: () => void
  onApply: (next: CardContent) => void
  /**
   * Fetches proposed rates for formats with no history. Omitted when there are
   * no gaps to fill, which is also why the button below is absent rather than
   * disabled — an offer that does nothing is worse than no offer.
   */
  onRequestSuggestions?: () => Promise<RateSuggestion[]>
}

/**
 * Edits everything on the card, including the labels.
 *
 * Every field is free text, deliberately. "₹29,500", "₹25–35K" and "From ₹25,000
 * + travel" are all things a creator genuinely says to a brand, and a form of
 * number inputs can express only the first. The card is a document she is about
 * to send under her own name, not a report — so the form edits the words, and
 * nothing here reinterprets what she typed.
 *
 * Changes apply to this share only. The card is rebuilt from live data next
 * time it opens, so a rate she adjusted for one negotiation cannot quietly
 * follow her into a send six months later when it is no longer true.
 */
export function CardEditorSheet({
  visible,
  content,
  onClose,
  onApply,
  onRequestSuggestions,
}: CardEditorSheetProps) {
  const { c } = useTheme()
  const [draft, setDraft] = useState<CardContent>(content)
  const [suggestions, setSuggestions] = useState<RateSuggestion[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [suggestFailed, setSuggestFailed] = useState(false)

  // Reseeded on open rather than on mount: the sheet outlives a single edit,
  // and reopening it should show what is on the card now, not what it showed
  // the first time.
  useEffect(() => {
    if (visible) {
      setDraft(content)
      setSuggestions([])
      setSuggestFailed(false)
    }
  }, [visible, content])

  async function handleSuggest() {
    if (!onRequestSuggestions || suggesting) return
    setSuggesting(true)
    setSuggestFailed(false)
    try {
      setSuggestions(await onRequestSuggestions())
    } catch {
      setSuggestFailed(true)
    } finally {
      setSuggesting(false)
    }
  }

  function acceptSuggestion(suggestion: RateSuggestion) {
    setDraft((prev) => ({
      ...prev,
      rates: [
        ...prev.rates,
        { label: suggestion.label, value: `₹${suggestion.rate.toLocaleString('en-IN')}` },
      ],
    }))
    setSuggestions((prev) => prev.filter((s) => s.kind !== suggestion.kind))
  }

  function set<K extends keyof CardContent>(key: K, value: CardContent[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function setRate(index: number, patch: Partial<{ label: string; value: string }>) {
    setDraft((prev) => ({
      ...prev,
      rates: prev.rates.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }))
  }

  function setStat(index: number, patch: Partial<{ label: string; value: string }>) {
    setDraft((prev) => ({
      ...prev,
      stats: prev.stats.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }))
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Edit card">
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.section, { color: c.textSecondary }]}>Front</Text>

        <TextField label="Name" value={draft.name} onChangeText={(v) => set('name', v)} />
        <TextField
          label="Tagline"
          value={draft.tagline}
          onChangeText={(v) => set('tagline', v)}
          placeholder="What you make, and where"
        />
        <TextField
          label="Handles"
          value={draft.handles}
          onChangeText={(v) => set('handles', v)}
          autoCapitalize="none"
        />

        <Text style={[styles.section, { color: c.textSecondary }]}>Headline figures</Text>
        {draft.stats.map((stat, index) => (
          <View key={index} style={styles.pair}>
            <View style={styles.pairLabel}>
              <TextField
                label="Label"
                value={stat.label}
                onChangeText={(v) => setStat(index, { label: v })}
              />
            </View>
            <View style={styles.pairValue}>
              <TextField
                label="Value"
                value={stat.value}
                onChangeText={(v) => setStat(index, { value: v })}
              />
            </View>
            <PressableScale
              onPress={() =>
                setDraft((prev) => ({ ...prev, stats: prev.stats.filter((_, i) => i !== index) }))
              }
              hitSlop={HitSlop}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${stat.label || 'this figure'}`}
              style={styles.remove}
            >
              <Ionicons name="close" size={17} color={c.textMuted} />
            </PressableScale>
          </View>
        ))}
        <PressableScale
          onPress={() =>
            setDraft((prev) => ({ ...prev, stats: [...prev.stats, { label: '', value: '' }] }))
          }
          accessibilityRole="button"
          accessibilityLabel="Add a figure"
          style={[styles.add, { backgroundColor: c.accentLight }]}
        >
          <Ionicons name="add" size={16} color={c.accent} />
          <Text style={[styles.addText, { color: c.accentText }]}>Add a figure</Text>
        </PressableScale>

        <Text style={[styles.section, { color: c.textSecondary }]}>Rates</Text>
        <TextField
          label="Heading"
          value={draft.ratesHeading}
          onChangeText={(v) => set('ratesHeading', v)}
        />
        {draft.rates.map((rate, index) => (
          <View key={index} style={styles.pair}>
            <View style={styles.pairLabel}>
              <TextField
                label="Deliverable"
                value={rate.label}
                onChangeText={(v) => setRate(index, { label: v })}
              />
            </View>
            <View style={styles.pairValue}>
              <TextField
                label="Price"
                value={rate.value}
                onChangeText={(v) => setRate(index, { value: v })}
              />
            </View>
            <PressableScale
              onPress={() =>
                setDraft((prev) => ({ ...prev, rates: prev.rates.filter((_, i) => i !== index) }))
              }
              hitSlop={HitSlop}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${rate.label || 'this rate'}`}
              style={styles.remove}
            >
              <Ionicons name="close" size={17} color={c.textMuted} />
            </PressableScale>
          </View>
        ))}
        <PressableScale
          onPress={() =>
            setDraft((prev) => ({ ...prev, rates: [...prev.rates, { label: '', value: '' }] }))
          }
          accessibilityRole="button"
          accessibilityLabel="Add a rate"
          style={[styles.add, { backgroundColor: c.accentLight }]}
        >
          <Ionicons name="add" size={16} color={c.accent} />
          <Text style={[styles.addText, { color: c.accentText }]}>Add a rate</Text>
        </PressableScale>

        {/* Only for formats with no history. Her own rates are never revised
            by this, and a suggestion is not on the card until she adds it. */}
        {onRequestSuggestions ? (
          <PressableScale
            onPress={handleSuggest}
            disabled={suggesting}
            accessibilityRole="button"
            accessibilityLabel="Suggest rates for formats you have not sold"
            style={[styles.add, { backgroundColor: c.accentLight, marginTop: Spacing.sm }]}
          >
            <Ionicons name="sparkles-outline" size={16} color={c.accent} />
            <Text style={[styles.addText, { color: c.accentText }]}>
              {suggesting ? 'Thinking…' : 'Suggest rates for formats you have not sold'}
            </Text>
          </PressableScale>
        ) : null}

        {suggestFailed ? (
          <Text style={[styles.hint, { color: c.textMuted }]}>
            Could not reach the pricing model. Your own rates are unaffected.
          </Text>
        ) : null}

        {suggestions.map((suggestion) => (
          <View
            key={suggestion.kind}
            style={[styles.suggestion, { backgroundColor: c.accentLight }]}
          >
            <View style={styles.suggestionText}>
              <Text style={[styles.suggestionTitle, { color: c.textPrimary }]}>
                {suggestion.label} · ₹{suggestion.rate.toLocaleString('en-IN')}
              </Text>
              {suggestion.basis ? (
                <Text style={[styles.hint, { color: c.textSecondary }]}>{suggestion.basis}</Text>
              ) : null}
            </View>
            <PressableScale
              onPress={() => acceptSuggestion(suggestion)}
              hitSlop={HitSlop}
              accessibilityRole="button"
              accessibilityLabel={`Add ${suggestion.label} at ${suggestion.rate} rupees`}
            >
              <Ionicons name="add-circle" size={22} color={c.accent} />
            </PressableScale>
          </View>
        ))}

        <Text style={[styles.section, { color: c.textSecondary }]}>Back</Text>
        <TextField
          label="Paragraph"
          value={draft.about}
          onChangeText={(v) => set('about', v)}
          multiline
          placeholder="Anything a brand should read before the numbers"
        />
        <TextField
          label="Contact heading"
          value={draft.contactHeading}
          onChangeText={(v) => set('contactHeading', v)}
        />
        <TextField
          label="Contact"
          value={draft.contact}
          onChangeText={(v) => set('contact', v)}
          multiline
        />
        <TextField
          label="Small print"
          value={draft.footnote}
          onChangeText={(v) => set('footnote', v)}
        />

        <View style={styles.actions}>
          <Button
            label="Apply"
            onPress={() => {
              onApply(draft)
              onClose()
            }}
            fullWidth
          />
          <Button label="Cancel" variant="ghost" onPress={onClose} fullWidth />
        </View>
      </ScrollView>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 460,
  },
  section: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  pairLabel: { flex: 1.4 },
  pairValue: { flex: 1 },
  remove: {
    paddingBottom: Spacing.base,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
  },
  addText: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  hint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 17,
    marginTop: Spacing.xs,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  suggestionText: { flex: 1 },
  suggestionTitle: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  actions: {
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
})
