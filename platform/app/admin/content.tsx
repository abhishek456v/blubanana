import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/core'
import { listContent, saveContent, type ContentLine } from '@/lib/admin'
import { refreshContent } from '@/hooks/useContent'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { Button, Card, TextField, useToast } from '@/components/ui'

/**
 * Rewording the parts of the product that get reworded.
 *
 * Not every string. The app carries roughly 380 pieces of visible text, and
 * putting all of them in a table would make the interface arrive after the
 * screens do and leave nothing checking that a label exists before it ships.
 * What is here is the copy somebody actually changes: marketing headlines, and
 * the onboarding lines that get rephrased every time a person is confused by
 * them.
 *
 * Every line has the shipped words behind it. If a row went missing, or the
 * database could not be reached, the product reads exactly as it does now.
 */
export default function AdminContent() {
  const { c } = useTheme()
  const toast = useToast()

  const [lines, setLines] = useState<ContentLine[]>([])
  const [edited, setEdited] = useState<Record<string, string>>({})
  const [deployReady, setDeployReady] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { rows, deployConfigured } = await listContent()
      setLines(rows)
      setDeployReady(deployConfigured)
      setEdited({})
    } catch {
      toast('Could not load the copy', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const save = async (line: ContentLine) => {
    const value = edited[line.key]
    if (value === undefined || value === line.value) return

    setSaving(line.key)
    try {
      const { deployed } = await saveContent(line.key, value)
      refreshContent()
      setLines((current) =>
        current.map((row) => (row.key === line.key ? { ...row, value } : row))
      )
      setEdited((current) => {
        const next = { ...current }
        delete next[line.key]
        return next
      })
      toast(
        line.area === 'app'
          ? 'Saved. People see it next time they open the app.'
          : deployed
            ? 'Saved. The website is rebuilding.'
            : 'Saved, but the website cannot rebuild yet.'
      )
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That did not save', { tone: 'error' })
    } finally {
      setSaving(null)
    }
  }

  const groups: { area: ContentLine['area']; title: string; hint: string }[] = [
    {
      area: 'website',
      title: 'On the website',
      hint: 'Takes effect when the site rebuilds, a minute or two after saving.',
    },
    {
      area: 'app',
      title: 'In the app',
      hint: 'Takes effect the next time somebody opens it. No release needed.',
    },
  ]

  return (
    <AdminScreen
      title="Words"
      hint="The copy that gets reworded. Everything else stays in the code, where it belongs."
      loading={loading}
    >
      {!deployReady ? (
        <View style={[styles.notice, { backgroundColor: c.warningLight }]}>
          <Text style={[styles.noticeText, { color: c.warning }]}>
            Website copy saves here, but the site cannot be asked to rebuild yet, so it will keep
            showing the old words. It needs a Vercel deploy hook, which is a one time setup.
          </Text>
        </View>
      ) : null}

      {groups.map((group) => {
        const rows = lines.filter((line) => line.area === group.area)
        if (rows.length === 0) return null

        return (
          <View key={group.area} style={styles.group}>
            <Text style={[styles.groupTitle, { color: c.textPrimary }]}>{group.title}</Text>
            <Text style={[styles.groupHint, { color: c.textSecondary }]}>{group.hint}</Text>

            {rows.map((line) => {
              const value = edited[line.key] ?? line.value
              const changed = value !== line.value

              return (
                <Card key={line.key}>
                  <TextField
                    label={line.label}
                    hint={line.hint ?? undefined}
                    value={value}
                    onChangeText={(next) =>
                      setEdited((current) => ({ ...current, [line.key]: next }))
                    }
                    // Only for copy that is genuinely a paragraph. A headline
                    // in a tall box leaves a hand-sized hole under every one.
                    multiline={line.value.length > 120}
                  />
                  {changed ? (
                    <View style={styles.actions}>
                      <Button
                        label="Put it back"
                        variant="secondary"
                        size="sm"
                        onPress={() =>
                          setEdited((current) => {
                            const next = { ...current }
                            delete next[line.key]
                            return next
                          })
                        }
                      />
                      <Button
                        label={saving === line.key ? 'Saving' : 'Save'}
                        size="sm"
                        onPress={() => save(line)}
                        disabled={saving === line.key}
                      />
                    </View>
                  ) : null}
                </Card>
              )
            })}
          </View>
        )
      })}
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  group: { gap: Spacing.sm, marginTop: Spacing.sm },
  groupTitle: { ...Typography.heading, fontFamily: FontFamily.semiBold },
  groupHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  notice: { borderRadius: Radius.md, padding: Spacing.md },
  noticeText: { ...Typography.caption, fontFamily: FontFamily.regular, lineHeight: 19 },
})
