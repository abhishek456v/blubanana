import { useCallback, useState } from 'react'
import { StyleSheet, Switch, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/core'
import { listFlags, setFlag, type FeatureFlag } from '@/lib/admin'
import { refreshFeatureFlags } from '@/hooks/useFeatureFlags'
import { formatRelativeDay } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { usePlatformRole } from '@/hooks/usePlatformRole'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { useConfirm, useToast } from '@/components/ui'

/**
 * Light switches, not an experiment framework.
 *
 * The evening these earn their keep is the one where Meta changes something,
 * Instagram figures start coming back as nonsense, and the choice would
 * otherwise be between shipping a release to every installed phone and leaving
 * it broken overnight.
 *
 * Nothing here is per-user. A flag that is on for some people and off for
 * others is a different, much larger thing, and this is a switch on a wall.
 */
export default function AdminFlags() {
  const { c } = useTheme()
  const toast = useToast()
  const confirm = useConfirm()
  const { role } = usePlatformRole()

  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)

  const canFlip = role === 'admin'

  const load = useCallback(async () => {
    try {
      setFlags(await listFlags())
    } catch {
      toast('Could not load the switches', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const flip = async (flag: FeatureFlag, enabled: boolean) => {
    // Turning something on is safe. Turning it off takes a feature away from
    // everybody at once, which is worth a sentence and a second press.
    if (!enabled) {
      const ok = await confirm({
        title: `Turn off ${flag.label.toLowerCase()}?`,
        message: `${flag.description} This affects everybody, straight away.`,
        confirmLabel: 'Turn it off',
        destructive: true,
      })
      if (!ok) return
    }

    try {
      await setFlag(flag.key, enabled)
      refreshFeatureFlags()
      setFlags((current) =>
        current.map((f) => (f.key === flag.key ? { ...f, enabled } : f))
      )
      toast(enabled ? 'Turned on' : 'Turned off')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That did not work', { tone: 'error' })
      load()
    }
  }

  return (
    <AdminScreen
      title="Switches"
      hint={
        canFlip
          ? 'Turn a part of the product off without shipping anything. Everybody sees the change at once.'
          : 'Only an admin can change these.'
      }
      loading={loading}
    >
      {flags.map((flag) => (
        <View key={flag.key} style={[styles.row, { backgroundColor: c.bgSurface }]}>
          <View style={styles.text}>
            <Text style={[styles.label, { color: c.textPrimary }]}>{flag.label}</Text>
            <Text style={[styles.description, { color: c.textSecondary }]}>
              {flag.description}
            </Text>
            <Text style={[styles.meta, { color: c.textMuted }]}>
              {flag.enabled ? 'On' : 'Off'} · changed {formatRelativeDay(flag.updated_at)}
            </Text>
          </View>
          <Switch
            value={flag.enabled}
            onValueChange={(value) => flip(flag, value)}
            disabled={!canFlip}
            trackColor={{ true: c.accent, false: c.border }}
            accessibilityLabel={flag.label}
          />
        </View>
      ))}
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  text: { flex: 1, gap: 2 },
  label: { ...Typography.bodyStrong, fontFamily: FontFamily.semiBold },
  description: { ...Typography.caption, fontFamily: FontFamily.regular, lineHeight: 18 },
  meta: { ...Typography.label, fontFamily: FontFamily.regular, marginTop: 2 },
})
