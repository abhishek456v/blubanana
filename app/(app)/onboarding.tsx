import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated'
import { updateProfile } from '@/lib/profile'
import { dismissOnboarding } from '@/lib/onboarding'
import {
  AuthFormMaxWidth,
  FontFamily,
  Radius,
  Spacing,
  Typography,
} from '@/constants/design'
import { Duration } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { Button, Mark, PressableScale, TextField, useToast } from '@/components/ui'

type Step = 'you' | 'money'

/**
 * Two-step onboarding, offered once after sign-up.
 *
 * Step one is who they are (niche, reach, phone); step two is how they get
 * paid (UPI or bank, GSTIN). Split in that order because step one is easy and
 * builds momentum, and step two is the one that actually unlocks something:
 * invoices can't be generated without payment details.
 *
 * Every field is skippable. The gate (lib/onboarding) never offers this screen
 * twice on the same device, so declining costs one tap, not a recurring nag.
 */
export default function OnboardingScreen() {
  const { c } = useTheme()
  const router = useRouter()
  const toast = useToast()

  const [step, setStep] = useState<Step>('you')
  const [saving, setSaving] = useState(false)

  const [phone, setPhone] = useState('')
  const [niche, setNiche] = useState('')
  const [followers, setFollowers] = useState('')
  const [upiId, setUpiId] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [gstin, setGstin] = useState('')

  async function leave() {
    await dismissOnboarding()
    router.replace('/(app)/(tabs)/' as never)
  }

  async function handleFinish() {
    setSaving(true)
    try {
      await updateProfile({
        phone: phone.trim() || null,
        niche: niche.trim() || null,
        follower_count: followers.trim() ? parseInt(followers, 10) : null,
        upi_id: upiId.trim() || null,
        bank_account_number: bankAccount.trim() || null,
        ifsc_code: ifscCode.trim() || null,
        gstin: gstin.trim().toUpperCase() || null,
      })
      toast('You are set up', { tone: 'success' })
    } catch {
      // The details are savable any time from You → Billing details; failing
      // here must not trap the creator on an onboarding screen.
      toast('Could not save. You can add this later under You', { tone: 'error' })
    } finally {
      setSaving(false)
      await leave()
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(Duration.slow)} style={styles.header}>
            <Mark size={34} color={c.accent} />

            {/* Two dots, not a percent bar: there are exactly two steps and
                the dots say which one without pretending to more precision. */}
            <View style={styles.dots}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: c.accent },
                  step === 'you' && styles.dotActive,
                ]}
              />
              <View
                style={[
                  styles.dot,
                  { backgroundColor: step === 'money' ? c.accent : c.borderStrong },
                  step === 'money' && styles.dotActive,
                ]}
              />
            </View>

            <PressableScale
              onPress={leave}
              accessibilityRole="button"
              accessibilityLabel="Skip setup"
            >
              <Text style={[styles.skip, { color: c.textMuted }]}>Skip</Text>
            </PressableScale>
          </Animated.View>

          {step === 'you' ? (
            <Animated.View entering={FadeInDown.duration(Duration.slow)} style={styles.body}>
              <Text style={[styles.title, { color: c.textPrimary }]}>
                Tell brands who you are
              </Text>
              <Text style={[styles.lede, { color: c.textSecondary }]}>
                This fills your profile card, the page you send a brand mid-negotiation.
                Everything is optional and editable later.
              </Text>

              <View style={styles.fields}>
                <TextField
                  label="Niche"
                  placeholder="Fashion, tech, food, finance…"
                  value={niche}
                  onChangeText={setNiche}
                  autoCapitalize="words"
                />
                <TextField
                  label="Followers"
                  placeholder="How many, roughly"
                  value={followers}
                  onChangeText={(t) => setFollowers(t.replace(/[^\d]/g, ''))}
                  keyboardType="number-pad"
                />
                <TextField
                  label="Phone"
                  placeholder="For payment reminders you send"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              </View>

              <Button label="Next" fullWidth onPress={() => setStep('money')} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInRight.duration(Duration.slow)} style={styles.body}>
              <Text style={[styles.title, { color: c.textPrimary }]}>How you get paid</Text>
              <Text style={[styles.lede, { color: c.textSecondary }]}>
                These go on the invoices you raise. UPI is enough to start; bank details and
                GSTIN can wait until a brand asks.
              </Text>

              <View style={styles.fields}>
                <TextField
                  label="UPI ID"
                  placeholder="you@upi"
                  value={upiId}
                  onChangeText={setUpiId}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextField
                  label="Account number"
                  placeholder="Bank account for larger deals"
                  value={bankAccount}
                  onChangeText={(t) => setBankAccount(t.replace(/[^\d]/g, ''))}
                  keyboardType="number-pad"
                />
                <TextField
                  label="IFSC"
                  placeholder="The branch code on your passbook"
                  value={ifscCode}
                  onChangeText={(t) => setIfscCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TextField
                  label="GSTIN"
                  placeholder="Only if you are GST-registered"
                  value={gstin}
                  onChangeText={(t) => setGstin(t.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  hint="Registered creators add 18% GST on invoices. Leave blank if unsure."
                />
              </View>

              {/* Offered at the end rather than the start: §8.2 says nothing in
                  onboarding is mandatory, and a creator who lands on a file
                  picker before she has typed her own name will close the app.
                  Placed here, it catches her at the moment she has just
                  finished and is looking at an empty dashboard. */}
              <PressableScale
                onPress={() => router.push('/(app)/import' as never)}
                accessibilityRole="button"
                accessibilityLabel="Import deals you already have"
                style={[styles.importRow, { borderColor: c.borderStrong }]}
              >
                <Ionicons name="sparkles-outline" size={16} color={c.accent} />
                <Text style={[styles.importText, { color: c.accentText }]}>
                  Already tracking deals somewhere? Bring them across
                </Text>
              </PressableScale>

              <Button label="Finish" fullWidth loading={saving} onPress={handleFinish} />
              <PressableScale
                onPress={() => setStep('you')}
                style={styles.backLink}
                accessibilityRole="button"
                accessibilityLabel="Back to the previous step"
              >
                <Ionicons name="chevron-back" size={14} color={c.textMuted} />
                <Text style={[styles.backText, { color: c.textMuted }]}>Back</Text>
              </PressableScale>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  importText: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    maxWidth: AuthFormMaxWidth + Spacing.lg * 2,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    opacity: 0.55,
  },
  dotActive: {
    opacity: 1,
    transform: [{ scale: 1.25 }],
  },
  skip: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
  body: {
    gap: Spacing.md,
  },
  title: {
    ...Typography.display,
    fontFamily: FontFamily.display,
  },
  lede: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    lineHeight: 21,
    marginBottom: Spacing.sm,
  },
  fields: {
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxs,
    paddingVertical: Spacing.sm,
  },
  backText: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
})
