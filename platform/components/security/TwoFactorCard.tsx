import { useCallback, useEffect, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  confirmEnrolment,
  listFactors,
  removeFactor,
  startEnrolment,
  type EnrolledFactor,
  type StartedEnrolment,
} from '@/lib/twoFactor'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import {
  Button,
  Card,
  QrCode,
  Skeleton,
  TextField,
  useConfirm,
  useToast,
} from '@/components/ui'

/**
 * Turning two-step verification on and off.
 *
 * The single most useful security control available here. A password is the
 * thing that actually gets stolen, through reuse or a convincing email, and
 * this is what makes a stolen one useless on its own.
 *
 * Three states: off, mid-enrolment, on. Enrolment deliberately does not finish
 * until a code from the app is accepted, so scanning the QR and then losing the
 * phone leaves the account exactly as it was rather than locked.
 */
export function TwoFactorCard() {
  const { c } = useTheme()
  const toast = useToast()
  const confirm = useConfirm()

  const [factors, setFactors] = useState<EnrolledFactor[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolment, setEnrolment] = useState<StartedEnrolment | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setFactors(await listFactors())
    } catch {
      // Not fatal. The card renders as "off" and trying again is one press.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const active = factors.find((f) => f.status === 'verified') ?? null

  async function handleStart() {
    setBusy(true)
    try {
      setEnrolment(await startEnrolment())
      setCode('')
      setCodeError(undefined)
    } catch {
      toast('Could not start two-step verification', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    if (!enrolment) return
    if (code.trim().length < 6) {
      setCodeError('Enter the 6 digit code from your app')
      return
    }
    setBusy(true)
    try {
      const ok = await confirmEnrolment(enrolment.factorId, code)
      if (!ok) {
        // Almost always a stale code rather than a typo: the app rolls every
        // thirty seconds and people finish typing after it has moved on.
        setCodeError('That code was wrong or has already expired. Try the current one.')
        return
      }
      setEnrolment(null)
      setCode('')
      await load()
      toast('Two-step verification is on', { tone: 'success' })
    } catch {
      toast('Could not turn it on', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    if (!active) return
    const ok = await confirm({
      title: 'Turn off two-step verification?',
      message:
        'Your password alone will get someone in after this. If it has ever been reused anywhere, leave this on.',
      confirmLabel: 'Turn off',
      destructive: true,
    })
    if (!ok) return

    try {
      await removeFactor(active.id)
      await load()
      toast('Two-step verification is off', { tone: 'neutral' })
    } catch (error) {
      console.error('removeFactor failed', error)
      // Supabase requires a session already at the higher level to unenrol,
      // which is correct: somebody who found an unlocked phone should not be
      // able to quietly remove the thing in their way.
      toast('Sign in again with a code, then turn it off', { tone: 'warning' })
    }
  }

  if (loading) {
    return (
      <Card>
        <Skeleton height={18} width="55%" />
        <View style={styles.loadingBody}>
          <Skeleton height={44} radius={Radius.sm} />
        </View>
      </Card>
    )
  }

  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: c.textPrimary }]}>Two-step verification</Text>
          <Text style={[styles.hint, { color: c.textSecondary }]}>
            A six digit code from your phone, on top of your password. It is what stops a
            stolen password being enough.
          </Text>
        </View>
        <View
          style={[
            styles.pill,
            { backgroundColor: active ? c.successLight : c.bgSurface },
          ]}
        >
          <Text style={[styles.pillText, { color: active ? c.success : c.textMuted }]}>
            {active ? 'On' : 'Off'}
          </Text>
        </View>
      </View>

      {enrolment ? (
        <View style={styles.enrol}>
          <Text style={[styles.step, { color: c.textPrimary }]}>
            1. Scan this in Google Authenticator, 1Password or Authy
          </Text>
          <View style={[styles.qrWrap, { backgroundColor: '#FFFFFF' }]}>
            <QrCode value={enrolment.uri} size={188} />
          </View>

          {/* Selectable rather than a copy button. A clipboard needs a native
              module, and adding one costs a whole new APK for every person
              already holding the old one. Long press selects it here. */}
          <View style={[styles.secretRow, { backgroundColor: c.bgSurface }]}>
            <Ionicons name="key-outline" size={15} color={c.textSecondary} />
            <Text selectable style={[styles.secret, { color: c.textSecondary }]}>
              {enrolment.secret}
            </Text>
          </View>
          <Text style={[styles.secretHint, { color: c.textMuted }]}>
            Cannot scan? Press and hold that key to copy it into your app by hand.
          </Text>

          <Text style={[styles.step, { color: c.textPrimary }]}>
            2. Type the code it shows
          </Text>
          <TextField
            label="Code"
            placeholder="000000"
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/[^0-9]/g, ''))
              if (codeError) setCodeError(undefined)
            }}
            error={codeError}
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="go"
            onSubmitEditing={handleConfirm}
          />

          <Button label="Turn it on" onPress={handleConfirm} loading={busy} fullWidth />
          <Button
            label="Cancel"
            variant="ghost"
            onPress={() => {
              setEnrolment(null)
              setCode('')
              setCodeError(undefined)
            }}
            fullWidth
          />
        </View>
      ) : active ? (
        <View style={styles.onBody}>
          <View style={[styles.note, { backgroundColor: c.successLight }]}>
            <Ionicons name="shield-checkmark-outline" size={15} color={c.success} />
            <Text style={[styles.noteText, { color: c.success }]}>
              You will be asked for a code each time you sign in on a new device.
            </Text>
          </View>
          <Button label="Turn off" variant="secondary" onPress={handleRemove} fullWidth />
        </View>
      ) : (
        <View style={styles.offBody}>
          <Button label="Set it up" onPress={handleStart} loading={busy} fullWidth />
        </View>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  headText: { flex: 1, gap: Spacing.xxs },
  title: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  hint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  pill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
  },
  pillText: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
  },
  loadingBody: { marginTop: Spacing.md },
  offBody: { marginTop: Spacing.md },
  onBody: { marginTop: Spacing.md, gap: Spacing.sm },
  enrol: { marginTop: Spacing.md, gap: Spacing.sm },
  step: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.xs,
  },
  // Always white behind the code. A dark background inverts the modules and
  // most scanners refuse an inverted code.
  qrWrap: {
    alignSelf: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  secretRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  secret: {
    flex: 1,
    ...Typography.caption,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    letterSpacing: 1,
  },
  secretHint: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.sm,
    padding: Spacing.sm + 2,
  },
  noteText: {
    flex: 1,
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    lineHeight: 18,
  },
})
