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
import { Link, useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '@/lib/supabase'
import { Colors, Spacing, Radius, Typography, FontFamily, AuthFormMaxWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { AuthShell } from '@/components/AuthShell'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const isWide = useIsWideScreen()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSendReset() {
    if (!email.trim()) {
      showAlert('Email required', 'Enter the email you signed up with.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('/reset-password'),
    })
    setLoading(false)

    if (error) {
      showAlert('Could not send reset email', error.message)
      return
    }
    // Supabase never reveals whether the email exists, by design — the
    // same confirmation shows either way.
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell>
      <View style={[styles.container, styles.centered, { backgroundColor: c.bgPage }]}>
        <View style={[styles.confirmInner, isWide && styles.innerWide]}>
          <Text style={[styles.wordmark, { color: c.textPrimary, fontFamily: FontFamily.display }]}>
            Check your email
          </Text>
          <Text style={[styles.confirmText, { color: c.textSecondary }]}>
            If an account exists for{'\n'}
            <Text style={{ color: c.textPrimary, fontFamily: FontFamily.medium }}>
              {email.trim()}
            </Text>
            {'\n\n'}
            we've sent a link to reset the password.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: c.fillPrimary }]}
            onPress={() => router.replace('/(auth)/sign-in')}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryButtonText, { color: c.onFillPrimary }]}>
              Back to sign in
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bgPage }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.inner, isWide && styles.innerWide]}>
        <Text style={[styles.wordmark, { color: c.textPrimary, fontFamily: FontFamily.display }]}>
          Reset password
        </Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Enter your email and we'll send you a reset link.
        </Text>

        <View style={styles.form}>
          <TextInput
            style={[
              styles.input,
              { borderColor: c.borderStrong, color: c.textPrimary, backgroundColor: c.bgSurface },
            ]}
            placeholder="Email"
            placeholderTextColor={c.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: c.fillPrimary }]}
            onPress={handleSendReset}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={c.onFillPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: c.onFillPrimary }]}>
                Send reset link
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/sign-in" asChild>
          <TouchableOpacity activeOpacity={0.7} style={styles.switchRow}>
            <Text style={[styles.switchText, { color: c.textSecondary }]}>
              Remembered it?{' '}
              <Text style={{ color: c.textPrimary, fontFamily: FontFamily.medium }}>
                Sign in
              </Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
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
  confirmInner: {
    width: '100%',
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
  confirmText: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    lineHeight: 22,
    marginTop: Spacing.md,
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
  switchRow: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  switchText: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
})
