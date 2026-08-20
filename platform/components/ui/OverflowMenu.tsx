import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'
import { Sheet } from './Sheet'

export interface OverflowAction {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  /** Red, and sorted to the bottom. */
  destructive?: boolean
  /** Shown greyed with a reason instead of doing nothing when pressed. */
  disabledReason?: string
}

export interface OverflowMenuProps {
  actions: OverflowAction[]
  /**
   * What the menu is about: a brand's name, an invoice number.
   *
   * Titles the sheet and names it for a screen reader, so it wants to be the
   * thing itself rather than a phrase. Pass a plain noun as the fallback when
   * the record has not loaded: "Brand" reads as a heading, "this brand" does
   * not.
   */
  subject: string
}

/**
 * The three dots.
 *
 * Rare and destructive actions belong behind one press, not on the screen
 * beside the things people use constantly. A Delete button sitting next to
 * Save is a Delete button that eventually gets pressed by someone reaching
 * for Save, and there is no undo behind it.
 *
 * Destructive actions sort to the bottom whatever order they are passed in,
 * so the dangerous one is never where a thumb lands first.
 */
export function OverflowMenu({ actions, subject }: OverflowMenuProps) {
  const { c } = useTheme()
  const [open, setOpen] = useState(false)

  const ordered = [...actions].sort(
    (a, b) => Number(a.destructive ?? false) - Number(b.destructive ?? false)
  )

  return (
    <>
      <PressableScale
        onPress={() => setOpen(true)}
        hitSlop={HitSlop}
        accessibilityRole="button"
        accessibilityLabel={`More options for ${subject}`}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={c.textSecondary} />
      </PressableScale>

      <Sheet visible={open} onClose={() => setOpen(false)} title={subject}>
        <View style={styles.list}>
          {ordered.map((action) => {
            const disabled = !!action.disabledReason
            const tint = disabled ? c.textMuted : action.destructive ? c.danger : c.textPrimary
            return (
              <PressableScale
                key={action.label}
                disabled={disabled}
                onPress={() => {
                  // Closed first: the confirm that usually follows is itself a
                  // sheet, and two stacked sheets leave the backdrop behind
                  // when the top one dismisses.
                  setOpen(false)
                  action.onPress()
                }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={[
                  styles.row,
                  {
                    backgroundColor: action.destructive ? c.dangerLight : c.bgSurface,
                    opacity: disabled ? 0.55 : 1,
                  },
                ]}
              >
                <Ionicons name={action.icon} size={18} color={tint} />
                <View style={styles.rowText}>
                  <Text style={[styles.label, { color: tint }]}>{action.label}</Text>
                  {action.disabledReason ? (
                    <Text style={[styles.reason, { color: c.textMuted }]}>
                      {action.disabledReason}
                    </Text>
                  ) : null}
                </View>
              </PressableScale>
            )
          })}
        </View>
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.base,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  label: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
  reason: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
})
