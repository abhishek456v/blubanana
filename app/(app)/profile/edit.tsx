import { useState, useEffect } from 'react'
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
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getProfile, updateProfile } from '@/lib/profile'
import { Colors, Spacing, Radius, Typography, FontFamily, ContentMaxWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { ModalSheet } from '@/components/ModalSheet'

export default function EditProfileScreen() {
  const router = useRouter()
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const isWide = useIsWideScreen()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [followerCount, setFollowerCount] = useState('')

  useEffect(() => {
    let active = true
    getProfile()
      .then((profile) => {
        if (!active) return
        setName(profile.name)
        setPhone(profile.phone ?? '')
        setFollowerCount(profile.follower_count != null ? String(profile.follower_count) : '')
      })
      .catch(() => {
        if (active) Alert.alert('Error', 'Could not load your profile.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

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
      Alert.alert('Name required', 'Enter your name.')
      return
    }

    setSaving(true)
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        follower_count: followerCount.trim() ? parseInt(followerCount, 10) : null,
      })
      router.back()
    } catch {
      Alert.alert('Error', 'Could not save your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ModalSheet title="Edit profile">
      <SafeAreaView style={[styles.centered, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        <ActivityIndicator color={c.textMuted} />
      </SafeAreaView>
      </ModalSheet>
    )
  }

  return (
    <ModalSheet title="Edit profile">
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, isWide && styles.contentWide]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Name</Text>
          <TextInput
            style={inputStyle}
            placeholder="Your name"
            placeholderTextColor={c.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Phone</Text>
          <TextInput
            style={inputStyle}
            placeholder="+91 98765 43210"
            placeholderTextColor={c.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Follower count</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. 25000"
            placeholderTextColor={c.textMuted}
            value={followerCount}
            onChangeText={(v) => setFollowerCount(v.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
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
              <Text style={[styles.saveButtonText, { color: c.onFillPrimary }]}>Save</Text>
            )}
          </TouchableOpacity>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  contentWide: {
    maxWidth: ContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
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
