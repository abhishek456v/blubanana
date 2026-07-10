import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createBrand } from '@/lib/brands'
import { Colors, Spacing, Radius, Typography, FontFamily } from '@/constants/design'

export default function NewBrandScreen() {
  const router = useRouter()
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  // Prefilled when arriving from AI deal intake with a brand name that
  // didn't match any existing brand (see deal/new.tsx).
  const { name: prefillName } = useLocalSearchParams<{ name?: string }>()

  const [name, setName] = useState(prefillName ?? '')
  const [contactPerson, setContactPerson] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const inputStyle = [
    styles.input,
    {
      borderColor: c.borderStrong,
      color: c.textPrimary,
      backgroundColor: c.bgSurface,
    },
  ]

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter the brand or client name.')
      return
    }

    setSaving(true)
    try {
      await createBrand({
        name: name.trim(),
        contact_person: contactPerson.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        notes: notes.trim() || null,
      })
      router.back()
    } catch {
      Alert.alert('Error', 'Could not save brand. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: c.bgPage }]}
      edges={['bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Brand name</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Nike, Sony Music"
            placeholderTextColor={c.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus
          />

          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Contact person</Text>
          <TextInput
            style={inputStyle}
            placeholder="Name of your point of contact"
            placeholderTextColor={c.textMuted}
            value={contactPerson}
            onChangeText={setContactPerson}
            autoCapitalize="words"
          />

          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Contact phone</Text>
          <TextInput
            style={inputStyle}
            placeholder="+91 98765 43210"
            placeholderTextColor={c.textMuted}
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
          />

          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Contact email</Text>
          <TextInput
            style={inputStyle}
            placeholder="brand@example.com"
            placeholderTextColor={c.textMuted}
            value={contactEmail}
            onChangeText={setContactEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Notes</Text>
          <TextInput
            style={[inputStyle, styles.multiline]}
            placeholder="Anything useful to remember about this client"
            placeholderTextColor={c.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: c.fillPrimary }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={c.onFillPrimary} />
            ) : (
              <Text style={[styles.saveButtonText, { color: c.onFillPrimary }]}>
                Save brand
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  },
  sectionLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  multiline: {
    height: undefined,
    minHeight: 88,
    paddingTop: 11,
    paddingBottom: 11,
  },
  saveButton: {
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  saveButtonText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
})
