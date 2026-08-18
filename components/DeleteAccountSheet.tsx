import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { FontFamily, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { Button, Sheet, TextField } from '@/components/ui'

/** Typed, not tapped. See the note on the component. */
const CONFIRM_WORD = 'DELETE'

export interface DeleteAccountSheetProps {
  visible: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  busy?: boolean
}

/**
 * The confirmation for deleting an account.
 *
 * A typed word rather than a second "Are you sure?" button. The standard
 * two-tap confirm is defeated by the thing it exists to stop — a creator
 * tapping through a dialog she has stopped reading — and this is the one action
 * in the app with no undo and no export afterwards to fall back on.
 *
 * The list of what goes is specific rather than a general warning. "This cannot
 * be undone" is true of a lot of things; "your 40 deals, your invoices and your
 * brand contacts" is the sentence that makes someone stop and export first.
 */
export function DeleteAccountSheet({
  visible,
  onClose,
  onConfirm,
  busy,
}: DeleteAccountSheetProps) {
  const { c } = useTheme()
  const [typed, setTyped] = useState('')

  // Cleared on open, not on close: a sheet dismissed and reopened should not
  // still be armed from last time.
  useEffect(() => {
    if (visible) setTyped('')
  }, [visible])

  const armed = typed.trim().toUpperCase() === CONFIRM_WORD

  return (
    <Sheet visible={visible} onClose={onClose} title="Delete my account" dismissable={false}>
      <Text style={[styles.body, { color: c.textSecondary }]}>
        This permanently deletes your workspace and everything in it — every deal,
        brand, contact, payment, invoice, expense and file. It cannot be undone,
        and nobody at CreatorDesk can recover it afterwards.
      </Text>

      <Text style={[styles.body, { color: c.textSecondary }]}>
        If you want a copy first, close this and use{' '}
        <Text style={{ fontFamily: FontFamily.semiBold, color: c.textPrimary }}>
          Export my data
        </Text>
        . Once this is done there is nothing left to export.
      </Text>

      <View style={styles.field}>
        <TextField
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRM_WORD}
        />
      </View>

      <Button
        label={busy ? 'Deleting…' : 'Delete my account'}
        variant="danger"
        onPress={() => onConfirm()}
        disabled={!armed || busy}
        fullWidth
      />
      <Button label="Cancel" variant="ghost" onPress={onClose} disabled={busy} fullWidth />
    </Sheet>
  )
}

const styles = StyleSheet.create({
  body: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    lineHeight: 21,
    marginBottom: Spacing.md,
  },
  field: {
    marginBottom: Spacing.md,
  },
})
