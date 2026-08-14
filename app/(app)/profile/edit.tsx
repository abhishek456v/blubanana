import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getProfile, updateProfile } from '@/lib/profile'
import { ContentMaxWidth, FontFamily, Spacing, Typography } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { ModalSheet } from '@/components/ModalSheet'
import { Button, Skeleton, TextField, useToast } from '@/components/ui'

export default function EditProfileScreen() {
  const toast = useToast()
  const router = useRouter()
  const { c } = useTheme()
  const isWide = useIsWideScreen()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [followerCount, setFollowerCount] = useState('')
  const [niche, setNiche] = useState('')
  const [upiId, setUpiId] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [gstin, setGstin] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()

  useEffect(() => {
    let active = true
    getProfile()
      .then((profile) => {
        if (!active) return
        setName(profile.name)
        setPhone(profile.phone ?? '')
        setFollowerCount(profile.follower_count != null ? String(profile.follower_count) : '')
        setNiche(profile.niche ?? '')
        setUpiId(profile.upi_id ?? '')
        setBankAccount(profile.bank_account_number ?? '')
        setIfscCode(profile.ifsc_code ?? '')
        setGstin(profile.gstin ?? '')
      })
      .catch(() => {
        if (active) toast('Could not load your profile', { tone: 'error' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // toast is stable from the provider; re-running this on it would refetch
    // the profile on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSave() {
    if (!name.trim()) {
      setNameError('Enter your name')
      return
    }
    setNameError(undefined)

    setSaving(true)
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        follower_count: followerCount.trim() ? parseInt(followerCount, 10) : null,
        niche: niche.trim() || null,
        upi_id: upiId.trim() || null,
        bank_account_number: bankAccount.trim() || null,
        ifsc_code: ifscCode.trim() || null,
        gstin: gstin.trim() || null,
      })
      toast('Profile saved', { tone: 'success' })
      router.back()
    } catch {
      toast('Could not save your profile', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ModalSheet title="Your profile">
        <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
          <View style={[styles.content, isWide && styles.contentWide]}>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} height={62} />
            ))}
          </View>
        </SafeAreaView>
      </ModalSheet>
    )
  }

  return (
    <ModalSheet title="Your profile">
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
              label="Name"
              placeholder="Your name"
              value={name}
              onChangeText={(value) => {
                setName(value)
                if (nameError) setNameError(undefined)
              }}
              error={nameError}
              autoCapitalize="words"
            />

            <TextField
              label="Phone"
              placeholder="+91 98765 43210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />

            <TextField
              label="Niche"
              placeholder="Beauty, fitness, food, tech…"
              value={niche}
              onChangeText={setNiche}
              hint="Shown on your public profile card"
            />

            <TextField
              label="Followers"
              placeholder="50000"
              value={followerCount}
              onChangeText={(value) => setFollowerCount(value.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              hint="Snapshotted on each new deal, so the app can tell you when your reach has outgrown your rate"
            />

            <View style={styles.sectionBreak}>
              <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Billing</Text>
              <Text style={[styles.sectionHint, { color: c.textSecondary }]}>
                Printed on the invoices you send. Never shown on your public profile.
              </Text>
            </View>

            <TextField
              label="GSTIN"
              placeholder="22AAAAA0000A1Z5"
              value={gstin}
              onChangeText={(value) => setGstin(value.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              hint="Leave blank if you're not GST registered"
            />

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
              placeholder="Bank account number"
              value={bankAccount}
              onChangeText={setBankAccount}
              keyboardType="number-pad"
            />

            <TextField
              label="IFSC"
              placeholder="HDFC0001234"
              value={ifscCode}
              onChangeText={(value) => setIfscCode(value.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Button
              label="Save"
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
  sectionBreak: {
    marginTop: Spacing.sm,
    gap: Spacing.xxs,
  },
  sectionTitle: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  sectionHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  submit: {
    marginTop: Spacing.sm,
  },
})
