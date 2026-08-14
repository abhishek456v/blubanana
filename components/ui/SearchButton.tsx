import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextInput,
  type ViewStyle,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { search, type SearchResult, type SearchResultKind } from '@/lib/search'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { BrandAvatar } from '@/components/BrandAvatar'
import { PressableScale } from './PressableScale'
import { Sheet } from './Sheet'
import { TextField } from './TextField'

export interface SearchButtonProps {
  size?: number
  style?: StyleProp<ViewStyle>
}

/** Wait for the typist to pause before hitting the network. */
const DEBOUNCE_MS = 250

const KIND_ICON: Record<SearchResultKind, keyof typeof Ionicons.glyphMap> = {
  deal: 'briefcase',
  brand: 'people',
  invoice: 'document-text',
}

/**
 * The magnifier in the header, and the search overlay it opens.
 *
 * One component rather than a button plus a separately-mounted sheet, so every
 * screen gets search by rendering `HeaderUtilities` and nothing else has to
 * remember to place the overlay.
 *
 * Results are grouped under the query as a flat ranked list — at six per kind
 * the total is small enough that section headers would take more height than
 * they organise.
 */
export function SearchButton({ size = 40, style }: SearchButtonProps) {
  const { c } = useTheme()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const inputRef = useRef<TextInput>(null)
  // Stamped per keystroke so a slow response for "ny" cannot overwrite the
  // results for "nyka" that already arrived.
  const requestId = useRef(0)

  useEffect(() => {
    if (!open) return
    const id = ++requestId.current

    if (query.trim().length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    const timer = setTimeout(async () => {
      const found = await search(query).catch(() => [])
      if (requestId.current === id) {
        setResults(found)
        setSearching(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query, open])

  const close = useCallback(() => {
    setOpen(false)
    // Cleared on close, not open: reopening to a stale query flashes old
    // results before the effect catches up.
    setQuery('')
    setResults([])
  }, [])

  function openResult(result: SearchResult) {
    close()
    const path =
      result.kind === 'deal'
        ? `/(app)/deal/${result.id}`
        : result.kind === 'brand'
          ? `/(app)/brand/${result.id}`
          : `/(app)/invoice/${result.id}`
    router.push(path as never)
  }

  return (
    <>
      <PressableScale
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Search deals, brands and invoices"
        style={[
          styles.button,
          { width: size, height: size, backgroundColor: c.bgSurface },
          style,
        ]}
      >
        <Ionicons name="search" size={size * 0.45} color={c.textPrimary} />
      </PressableScale>

      <Sheet visible={open} onClose={close} title="Search">
        <View style={styles.body}>
          <TextField
            ref={inputRef}
            placeholder="Deals, brands, invoice numbers"
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            trailing={
              searching ? <ActivityIndicator size="small" color={c.textMuted} /> : undefined
            }
          />

          {query.trim().length < 2 ? (
            <Text style={[styles.hint, { color: c.textMuted }]}>
              Type a brand, a deliverable, or an invoice number.
            </Text>
          ) : !searching && results.length === 0 ? (
            <Text style={[styles.hint, { color: c.textMuted }]}>
              Nothing matches “{query.trim()}”.
            </Text>
          ) : (
            <View style={styles.results}>
              {results.map((result) => (
                <PressableScale
                  key={`${result.kind}-${result.id}`}
                  onPress={() => openResult(result)}
                  style={[styles.row, { backgroundColor: c.bgSurface }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${result.title}, ${result.subtitle}`}
                >
                  {result.kind === 'brand' ? (
                    <BrandAvatar name={result.title} size={34} />
                  ) : (
                    <View style={[styles.iconBox, { backgroundColor: c.accentLight }]}>
                      <Ionicons name={KIND_ICON[result.kind]} size={16} color={c.accent} />
                    </View>
                  )}
                  <View style={styles.rowText}>
                    <Text
                      style={[styles.rowTitle, { color: c.textPrimary }]}
                      numberOfLines={1}
                    >
                      {result.title}
                    </Text>
                    <Text
                      style={[styles.rowSubtitle, { color: c.textMuted }]}
                      numberOfLines={1}
                    >
                      {result.subtitle}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
                </PressableScale>
              ))}
            </View>
          )}
        </View>
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
    // Fixed height, not content-sized: a sheet that grows and shrinks as
    // results stream in bounces the keyboard anchor around under the typist.
    minHeight: 320,
  },
  hint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  results: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.md,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  rowSubtitle: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
})
