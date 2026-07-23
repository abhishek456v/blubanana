import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useColorScheme,
} from 'react-native'
import { showAlert } from '@/lib/alert'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Colors, Spacing, Radius, Typography, FontFamily, AuthFormMaxWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const isWide = useIsWideScreen()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleReset() {
    if (password.length < 8) {
      showAlert('Weak password', 'Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      showAlert("Passwords don't match", 'Enter the same password in both fields.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setLoading(false)
      showAlert('Could not update password', error.message)
      return
    }

    // Sign out of the recovery session and send the creator back to sign in
    // with the new password — cleaner than silently treating a recovery
    // session as a real login, and sidesteps app/_layout.tsx's redirect
    // needing to know the reset "finished" from in here.
    await supabase.auth.signOut()
    setLoading(false)
    router.replace('/(auth)/sign-in')
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bgPage }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.inner, isWide && styles.innerWide]}>
        <Text style={[styles.wordmark, { color: c.textPrimary }]}>Set a new password</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Choose a new password for your account.
        </Text>

        <View style={styles.form}>
          <TextInput
            style={[
              styles.input,
              { borderColor: c.borderStrong, color: c.textPrimary, backgroundColor: c.bgSurface },
            ]}
            placeholder="New password (min 8 characters)"
            placeholderTextColor={c.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <TextInput
            style={[
              styles.input,
              { borderColor: c.borderStrong, color: c.textPrimary, backgroundColor: c.bgSurface },
            ]}
            placeholder="Confirm new password"
            placeholderTextColor={c.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: c.fillPrimary }]}
            onPress={handleReset}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={c.onFillPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: c.onFillPrimary }]}>
                Update password
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  innerWide: {
    maxWidth: AuthFormMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  wordmark: {
    ...Typography.display,
    fontFamily: FontFamily.semiBold,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    marginBottom: Spacing.xl,
  },
  form: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  primaryButton: {
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  primaryButtonText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
})
