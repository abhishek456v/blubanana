import { StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated'
import { FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { Duration } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { DateField, PressableScale } from '@/components/ui'
import type { StageDraft } from '@/lib/dealStages'

const NODE = 26

export interface StageEditorProps {
  stages: StageDraft[]
  onChange: (stages: StageDraft[]) => void
  /** Hides the done toggles, for a deal that does not exist yet. */
  allowDone?: boolean
  disabled?: boolean
}

/**
 * The deal's workflow, as an editable list.
 *
 * Replaces a fixed Script/Shoot/Edit/Publish stepper. Creators do not all work
 * the same way: some script and shoot on the same day, some run a
 * client-review round, some do three edit passes. A new deal still starts with
 * those four because they fit most people, but every one of them can be
 * renamed, removed, or added to.
 *
 * The name is a text input rather than a label, so renaming is direct: there
 * is no edit mode to enter and no dialog to open. The row *is* the control.
 */
export function StageEditor({
  stages,
  onChange,
  allowDone = true,
  disabled = false,
}: StageEditorProps) {
  const { c } = useTheme()

  const update = (index: number, patch: Partial<StageDraft>) => {
    onChange(stages.map((stage, i) => (i === index ? { ...stage, ...patch } : stage)))
  }

  const remove = (index: number) => {
    onChange(stages.filter((_, i) => i !== index))
  }

  const add = () => {
    onChange([...stages, { name: '', due_date: null, done: false }])
  }

  return (
    <View style={styles.root}>
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1

        return (
          <Animated.View
            key={stage.id ?? `draft-${index}`}
            entering={FadeIn.duration(Duration.fast)}
            exiting={FadeOut.duration(Duration.fast)}
            layout={Layout.duration(Duration.base)}
            style={styles.row}
          >
            <View style={styles.rail}>
              <PressableScale
                onPress={() => allowDone && !disabled && update(index, { done: !stage.done })}
                disabled={!allowDone || disabled}
                hitSlop={HitSlop}
                haptic="selection"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: stage.done }}
                accessibilityLabel={`${stage.name || 'Stage'}: ${stage.done ? 'done' : 'not done'}`}
                style={[
                  styles.node,
                  stage.done
                    ? { backgroundColor: c.success, borderColor: c.success }
                    : { borderColor: c.borderStrong },
                ]}
              >
                {stage.done ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
              </PressableScale>

              {/* The connector stops at the last stage so the list does not
                  trail a line into the "add" button, which is not a stage. */}
              {!isLast ? <View style={[styles.connector, { backgroundColor: c.border }]} /> : null}
            </View>

            <View style={styles.body}>
              <View style={styles.nameRow}>
                <TextInput
                  value={stage.name}
                  onChangeText={(name) => update(index, { name })}
                  placeholder="Name this stage"
                  placeholderTextColor={c.textMuted}
                  editable={!disabled}
                  style={[
                    styles.name,
                    {
                      color: c.textPrimary,
                      textDecorationLine: stage.done ? 'line-through' : 'none',
                    },
                  ]}
                />

                <PressableScale
                  onPress={() => remove(index)}
                  disabled={disabled}
                  hitSlop={HitSlop}
                  haptic="light"
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${stage.name || 'this stage'}`}
                >
                  <Ionicons name="close" size={17} color={c.textMuted} />
                </PressableScale>
              </View>

              <DateField
                variant="inline"
                value={stage.due_date}
                onChange={(due_date) => update(index, { due_date })}
                placeholder="Set date"
              />
            </View>
          </Animated.View>
        )
      })}

      <PressableScale
        onPress={add}
        disabled={disabled}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel="Add a stage"
        style={[styles.add, { backgroundColor: c.accentLight }]}
      >
        <Ionicons name="add" size={17} color={c.accent} />
        <Text style={[styles.addText, { color: c.accentText }]}>Add stage</Text>
      </PressableScale>

      {stages.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>
          No stages. This deal will not remind you about anything.
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  rail: {
    alignItems: 'center',
    width: NODE,
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
    width: 1.5,
    marginVertical: 4,
  },
  body: {
    flex: 1,
    paddingBottom: Spacing.md,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    flex: 1,
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
    // Kills the default padding React Native Web gives a text input, so the
    // name sits on the same baseline as the node beside it.
    paddingVertical: 0,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
    marginLeft: NODE + Spacing.base,
  },
  addText: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
  empty: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginLeft: NODE + Spacing.base,
  },
})
