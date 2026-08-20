import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createBrand } from '@/lib/brands'
import { replaceContacts } from '@/lib/brandContacts'
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
      // Name and notes only. The contact goes to `brand_contacts` just below;
      // it used to be written to both, and once migration 022 dropped those
      // three columns PostgREST rejected the whole insert, so adding a brand
      // failed outright.
      const created = await createBrand({
        name: name.trim(),
        notes: notes.trim() || null,
      })

      // Mirror the details into brand_contacts as the primary contact, so a
      // brand created here behaves like every other one. Brand detail is where
      // further contacts get added; this screen deliberately asks for one,
      // because at creation there is only ever one person you have met.
      await replaceContacts(created.id, [
        {
          name: contactPerson.trim(),
          phone: contactPhone.trim() || null,
          email: contactEmail.trim() || null,
          role: null,
          is_primary: true,
        },
      ])
      toast(`${name.trim()} added`, { tone: 'success' })
      router.back()
    } catch (error) {
      // The creator gets the plain sentence; the console gets the reason.
      // A bare `catch {}` here is what let a hard schema mismatch present as
      // a vague "could not save" for as long as it did.
      console.error('createBrand failed', error)
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

            {/* POC: the person at the brand she actually deals with. */}
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
