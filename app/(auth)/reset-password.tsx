import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { AuthFormMaxWidth, FontFamily, Spacing, Typography } from '@/constants/design'
import { Duration, staggerDelay } from '@/constants/motion'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { AuthShell } from '@/components/AuthShell'
import { Button, TextField, useToast } from '@/components/ui'

const MIN_PASSWORD_LENGTH = 8

export default function ResetPasswordScreen() {
  const { c } = useTheme()
  const isWide = useIsWideScreen()
  const router = useRouter()
  const toast = useToast()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})

  async function handleReset() {
    const nextErrors: typeof errors = {}
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `At least ${MIN_PASSWORD_LENGTH} characters`
    }
    if (password !== confirmPassword) {
      nextErrors.confirm = "These don't match"
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setLoading(false)
      toast(error.message, { tone: 'error' })
      return
    }

    // Sign out of the recovery session and send the creator back to sign in
    // with the new password — cleaner than silently treating a recovery
    // session as a real login, and it sidesteps app/_layout.tsx's redirect
    // needing to know the reset finished from in here.
    await supabase.auth.signOut()
    setLoading(false)
    toast('Password updated — sign in with it now', { tone: 'success' })
    router.replace('/(auth)/sign-in')
  }

  return (
    <AuthShell>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: c.bgPage }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.inner, isWide && styles.innerWide]}>
          <Animated.View entering={FadeInDown.duration(Duration.slow)}>
            <Text style={[styles.title, { color: c.textPrimary }]}>New password</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              Pick something you'll remember. You'll sign in with it next.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(1))}
            style={styles.form}
          >
            <TextField
              label="New password"
              placeholder="••••••••"
              value={password}
              onChangeText={(value) => {
                setPassword(value)
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }))
              }}
              error={errors.password}
              hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
            />

            <TextField
              label="Confirm password"
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value)
                if (errors.confirm) setErrors((e) => ({ ...e, confirm: undefined }))
              }}
              error={errors.confirm}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={handleReset}
            />

            <Button
              label="Update password"
              onPress={handleReset}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.submit}
            />
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </AuthShell>
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
  title: {
    ...Typography.display,
    fontFamily: FontFamily.display,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  form: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  submit: {
    marginTop: Spacing.xs,
  },
})
