import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createBrand } from '@/lib/brands'
import { ContentMaxWidth, Spacing } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { ModalSheet } from '@/components/ModalSheet'
import { Button, TextField, useToast } from '@/components/ui'

export default function NewBrandScreen() {
  const toast = useToast()
  const router = useRouter()
  const { c } = useTheme()
  const isWide = useIsWideScreen()

  // Prefilled when arriving from AI deal intake with a brand name that didn't
  // match any existing brand (see deal/new.tsx).
  const { name: prefillName } = useLocalSearchParams<{ name?: string }>()

  const [name, setName] = useState(prefillName ?? '')
  const [contactPerson, setContactPerson] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | undefined>()

  async function handleSave() {
    if (!name.trim()) {
      setNameError('Enter the brand or client name')
      return
    }
    setNameError(undefined)

    setSaving(true)
    try {
      await createBrand({
        name: name.trim(),
        contact_person: contactPerson.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        notes: notes.trim() || null,
      })
      toast(`${name.trim()} added`, { tone: 'success' })
      router.back()
    } catch {
      toast('Could not save that brand', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalSheet title="Add brand">
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.content, isWide && styles.contentWide]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextField
              label="Brand"
              placeholder="Nykaa"
              value={name}
              onChangeText={(value) => {
                setName(value)
                if (nameError) setNameError(undefined)
              }}
              error={nameError}
              autoCapitalize="words"
              returnKeyType="next"
            />

            {/* POC — the person at the brand she actually deals with. */}
            <TextField
              label="POC"
              placeholder="Who you talk to"
              value={contactPerson}
              onChangeText={setContactPerson}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <TextField
              label="Phone"
              placeholder="+91 98765 43210"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              hint="Used for the one-tap WhatsApp payment nudge"
              returnKeyType="next"
            />

            <TextField
              label="Email"
              placeholder="poc@brand.com"
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <TextField
              label="Notes"
              placeholder="Fussy about hook style. Pays slow, so ask for an advance."
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <Button
              label="Add brand"
              onPress={handleSave}
              loading={saving}
              fullWidth
              size="lg"
              style={styles.submit}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  contentWide: {
    maxWidth: ContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  submit: {
    marginTop: Spacing.sm,
  },
})
