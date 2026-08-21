import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import {
  deleteAnnouncement,
  isLive,
  listAnnouncements,
  saveAnnouncement,
  type Announcement,
} from '@/lib/admin'
import { formatDate } from '@/lib/format'
import {
  DesktopContentMaxWidth,
  FontFamily,
  HitSlop,
  Radius,
  Spacing,
  Typography,
} from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import {
  Button,
  Card,
  Chip,
  DateField,
  PressableScale,
  Skeleton,
  TextField,
  useConfirm,
  useToast,
} from '@/components/ui'

type Draft = Partial<Announcement>

const EMPTY: Draft = {
  kind: 'banner',
  placement: 'bar',
  surface: 'both',
  audience: 'everyone',
  dismissible: true,
  published: false,
  sort_order: 0,
}

/**
 * Writing something that appears on every screen.
 *
 * Compose on the left, everything ever published on the right. Publishing is a
 * separate press from saving, deliberately: a draft you can leave half written
 * is what stops the first version of a sentence going out to everybody.
 */
export default function AdminAnnouncements() {
  const { c } = useTheme()
  const { isDesktop } = useBreakpoint()
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()

  const [rows, setRows] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setRows(await listAnnouncements())
    } catch {
      toast('Could not load announcements', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  async function save(publish: boolean) {
    if (!draft.title?.trim()) {
      toast('Give it a title', { tone: 'warning' })
      return
    }
    setSaving(true)
    try {
      await saveAnnouncement({ ...draft, published: publish })
      setDraft(EMPTY)
      await load()
      toast(publish ? 'Published' : 'Saved as a draft', { tone: 'success' })
    } catch (error) {
      console.error('saveAnnouncement failed', error)
      toast('Could not save that', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function togglePublished(row: Announcement) {
    try {
      await saveAnnouncement({ ...row, published: !row.published })
      await load()
      toast(row.published ? 'Taken down' : 'Published', { tone: 'success' })
    } catch {
      toast('Could not change that', { tone: 'error' })
    }
  }

  async function remove(row: Announcement) {
    const ok = await confirm({
      title: `Delete "${row.title}"?`,
      message: 'It disappears from every screen immediately and cannot be brought back.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteAnnouncement(row.id)
      await load()
      toast('Deleted', { tone: 'neutral' })
    } catch {
      toast('Could not delete that', { tone: 'error' })
    }
  }

  const composer = (
    <Card>
      <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Write one</Text>

      <View style={styles.form}>
        <TextField
          label="Title"
          placeholder="Payments are back to normal"
          value={draft.title ?? ''}
          onChangeText={(v) => setDraft((d) => ({ ...d, title: v }))}
        />
        <TextField
          label="Message"
          placeholder="Optional. One or two sentences."
          value={draft.body ?? ''}
          onChangeText={(v) => setDraft((d) => ({ ...d, body: v }))}
          multiline
        />

        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>How it appears</Text>
        <View style={styles.chips}>
          {(
            [
              ['bar', 'A line in the top strip'],
              ['popup', 'A card over the page'],
              ['image', 'A picture at the top'],
            ] as const
          ).map(([value, label]) => (
            <Chip
              key={value}
              label={label}
              selected={draft.placement === value}
              onPress={() => setDraft((d) => ({ ...d, placement: value }))}
            />
          ))}
        </View>

        {draft.placement === 'image' || draft.placement === 'popup' ? (
          <TextField
            label={draft.placement === 'image' ? 'Image address' : 'Image address (optional)'}
            placeholder="https://…"
            value={draft.image_url ?? ''}
            onChangeText={(v) => setDraft((d) => ({ ...d, image_url: v || null }))}
            autoCapitalize="none"
            hint="Paste a link to the picture. The media library comes later."
          />
        ) : null}

        <TextField
          label="Link (optional)"
          placeholder="https://blubanana.in/pricing"
          value={draft.link_url ?? ''}
          onChangeText={(v) => setDraft((d) => ({ ...d, link_url: v || null }))}
          autoCapitalize="none"
        />
        {draft.link_url ? (
          <TextField
            label="Link wording"
            placeholder="See pricing"
            value={draft.link_label ?? ''}
            onChangeText={(v) => setDraft((d) => ({ ...d, link_label: v || null }))}
          />
        ) : null}

        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>How loud</Text>
        <View style={styles.chips}>
          {(['news', 'banner', 'alert'] as const).map((k) => (
            <Chip
              key={k}
              label={k === 'news' ? 'Quiet news' : k === 'banner' ? 'Banner' : 'Alert'}
              selected={draft.kind === k}
              tone={k === 'alert' ? 'danger' : 'accent'}
              onPress={() => setDraft((d) => ({ ...d, kind: k }))}
            />
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>Where</Text>
        <View style={styles.chips}>
          {(['both', 'app', 'website'] as const).map((s) => (
            <Chip
              key={s}
              label={s === 'both' ? 'App and website' : s === 'app' ? 'App only' : 'Website only'}
              selected={draft.surface === s}
              onPress={() => setDraft((d) => ({ ...d, surface: s }))}
            />
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>Who, inside the app</Text>
        <View style={styles.chips}>
          {(['everyone', 'trialing', 'paying', 'lapsed'] as const).map((a) => (
            <Chip
              key={a}
              label={a === 'everyone' ? 'Everyone' : a === 'trialing' ? 'On trial' : a === 'paying' ? 'Paying' : 'Lapsed'}
              selected={draft.audience === a}
              onPress={() => setDraft((d) => ({ ...d, audience: a }))}
            />
          ))}
        </View>

        <DateField
          label="Stop showing it on"
          value={draft.ends_at ? draft.ends_at.slice(0, 10) : null}
          onChange={(v) =>
            setDraft((d) => ({ ...d, ends_at: v ? new Date(`${v}T23:59:59Z`).toISOString() : null }))
          }
        />
        {/* The usual way a banner embarrasses somebody is by still being there
            in March, so the absence of an end date is said out loud. */}
        {!draft.ends_at ? (
          <Text style={[styles.warn, { color: c.warning }]}>
            No end date. It runs until you take it down by hand.
          </Text>
        ) : null}

        <Button
          label={saving ? 'Publishing…' : 'Publish now'}
          onPress={() => save(true)}
          disabled={saving}
          fullWidth
        />
        <Button
          label="Save as a draft"
          variant="secondary"
          onPress={() => save(false)}
          disabled={saving}
          fullWidth
        />
      </View>
    </Card>
  )

  const list = (
    <Card>
      <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Everything you have written</Text>
      {rows.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>Nothing yet.</Text>
      ) : (
        <View style={styles.rows}>
          {rows.map((row) => {
            const live = isLive(row)
            return (
              <View key={row.id} style={[styles.row, { backgroundColor: c.bgSurface }]}>
                <View style={styles.rowText}>
                  <View style={styles.rowHead}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: live ? c.success : row.published ? c.warning : c.textMuted },
                      ]}
                    />
                    <Text style={[styles.rowTitle, { color: c.textPrimary }]} numberOfLines={1}>
                      {row.title}
                    </Text>
                  </View>
                  <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
                    {live ? 'On screen now' : row.published ? 'Published, outside its dates' : 'Draft'}
                    {' · '}
                    {row.placement === 'bar' ? 'strip' : row.placement}
                    {' · '}
                    {row.surface === 'both' ? 'app and website' : row.surface}
                    {row.ends_at ? ` · until ${formatDate(row.ends_at.slice(0, 10))}` : ' · no end date'}
                  </Text>
                </View>

                <PressableScale
                  onPress={() => togglePublished(row)}
                  hitSlop={HitSlop}
                  accessibilityRole="button"
                  accessibilityLabel={row.published ? 'Take it down' : 'Publish it'}
                >
                  <Ionicons
                    name={row.published ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={c.textSecondary}
                  />
                </PressableScale>
                <PressableScale
                  onPress={() => remove(row)}
                  hitSlop={HitSlop}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${row.title}`}
                >
                  <Ionicons name="trash-outline" size={17} color={c.textMuted} />
                </PressableScale>
              </View>
            )
          })}
        </View>
      )}
    </Card>
  )

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, isDesktop && styles.contentWide]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <PressableScale
            onPress={() => router.replace('/admin' as never)}
            hitSlop={HitSlop}
            accessibilityRole="button"
            accessibilityLabel="Back to the dashboard"
          >
            <Ionicons name="arrow-back" size={20} color={c.textSecondary} />
          </PressableScale>
          <Text style={[styles.title, { color: c.textPrimary }]}>Broadcast</Text>
        </View>

        {loading ? (
          <Skeleton height={200} radius={Radius.lg} />
        ) : isDesktop ? (
          <View style={styles.columns}>
            <View style={styles.column}>{composer}</View>
            <View style={styles.column}>{list}</View>
          </View>
        ) : (
          <>
            {composer}
            {list}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.md },
  contentWide: {
    padding: Spacing.lg,
    maxWidth: DesktopContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  title: { ...Typography.display, fontFamily: FontFamily.display },
  columns: { flexDirection: 'row', gap: Spacing.lg, alignItems: 'flex-start' },
  column: { flex: 1, gap: Spacing.md },
  cardTitle: { ...Typography.heading, fontFamily: FontFamily.semiBold },
  form: { gap: Spacing.md, marginTop: Spacing.md },
  fieldLabel: { ...Typography.label, fontFamily: FontFamily.medium },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  warn: { ...Typography.caption, fontFamily: FontFamily.medium, lineHeight: 18 },
  empty: { ...Typography.body, fontFamily: FontFamily.regular, marginTop: Spacing.md },
  rows: { gap: Spacing.sm, marginTop: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.base,
  },
  rowText: { flex: 1, gap: 3 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { ...Typography.bodyStrong, fontFamily: FontFamily.medium, flex: 1 },
  rowMeta: { ...Typography.caption, fontFamily: FontFamily.regular },
})
