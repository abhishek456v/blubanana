import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated'
import { FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { Duration } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import type { ContactDraft } from '@/lib/brandContacts'
import { PressableScale, TextField } from '@/components/ui'

export interface ContactsEditorProps {
  contacts: ContactDraft[]
  onChange: (contacts: ContactDraft[]) => void
  disabled?: boolean
}

/**
 * The people at a brand.
 *
 * Agency contacts change constantly, and a payment chased at someone who left
 * six months ago is a payment that does not arrive. A brand used to hold
 * exactly one name, phone and email (migration 019 moved them to their own
 * table).
 *
 * Exactly one contact is primary, and that is the one the WhatsApp nudges
 * address. Choosing is a tap on the row rather than a switch per row, because
 * the choice is "which one", not "is this one" — a set of independent
 * switches invites the state where none is selected.
 */
export function ContactsEditor({ contacts, onChange, disabled = false }: ContactsEditorProps) {
  const { c } = useTheme()

  const update = (index: number, patch: Partial<ContactDraft>) => {
    onChange(contacts.map((contact, i) => (i === index ? { ...contact, ...patch } : contact)))
  }

  const makePrimary = (index: number) => {
    onChange(contacts.map((contact, i) => ({ ...contact, is_primary: i === index })))
  }

  const remove = (index: number) => {
    const next = contacts.filter((_, i) => i !== index)
    // Removing the primary would leave the brand with nobody to chase. Promote
    // whoever is left rather than silently losing the nudge target.
    if (next.length > 0 && !next.some((contact) => contact.is_primary)) {
      next[0] = { ...next[0], is_primary: true }
    }
    onChange(next)
  }

  const add = () => {
    onChange([
      ...contacts,
      {
        name: '',
        phone: null,
        email: null,
        role: null,
        is_primary: contacts.length === 0,
      },
    ])
  }

  return (
    <View style={styles.root}>
      {contacts.map((contact, index) => (
        <Animated.View
          key={contact.id ?? `draft-${index}`}
          entering={FadeIn.duration(Duration.fast)}
          exiting={FadeOut.duration(Duration.fast)}
          layout={Layout.duration(Duration.base)}
          style={[styles.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}
        >
          <View style={styles.cardHead}>
            <PressableScale
              onPress={() => makePrimary(index)}
              disabled={disabled}
              haptic="selection"
              accessibilityRole="radio"
              accessibilityState={{ selected: contact.is_primary }}
              accessibilityLabel={
                contact.is_primary
                  ? `${contact.name || 'This contact'} is the main contact`
                  : `Make ${contact.name || 'this contact'} the main contact`
              }
              style={styles.primaryToggle}
            >
              <Ionicons
                name={contact.is_primary ? 'checkmark-circle' : 'ellipse-outline'}
                size={19}
                color={contact.is_primary ? c.accent : c.textMuted}
              />
              <Text
                style={[
                  styles.primaryLabel,
                  { color: contact.is_primary ? c.accentText : c.textMuted },
                ]}
              >
                {contact.is_primary ? 'Main contact' : 'Make main'}
              </Text>
            </PressableScale>

            <PressableScale
              onPress={() => remove(index)}
              disabled={disabled}
              hitSlop={HitSlop}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={`Remove ${contact.name || 'this contact'}`}
            >
              <Ionicons name="close" size={17} color={c.textMuted} />
            </PressableScale>
          </View>

          <TextField
            label="Name"
            value={contact.name}
            onChangeText={(name) => update(index, { name })}
            placeholder="Who you deal with"
          />
          <TextField
            label="Role"
            value={contact.role ?? ''}
            onChangeText={(role) => update(index, { role })}
            placeholder="Marketing manager"
          />
          <TextField
            label="Phone"
            value={contact.phone ?? ''}
            onChangeText={(phone) => update(index, { phone })}
            keyboardType="phone-pad"
            placeholder="For the WhatsApp nudges"
          />
          <TextField
            label="Email"
            value={contact.email ?? ''}
            onChangeText={(email) => update(index, { email })}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="For invoices"
          />
        </Animated.View>
      ))}

      <PressableScale
        onPress={add}
        disabled={disabled}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel="Add a contact"
        style={[styles.add, { borderColor: c.borderStrong }]}
      >
        <Ionicons name="add" size={17} color={c.accent} />
        <Text style={[styles.addText, { color: c.accentText }]}>Add contact</Text>
      </PressableScale>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.base,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.base,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  primaryToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  primaryLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
  },
  addText: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
})
