const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins')

/**
 * Makes an iPhone build signable by a free personal Apple ID.
 *
 * Only runs when EXPO_LOCAL_IOS=1, which `npm run ios:local` sets. Every other
 * build — EAS preview, EAS production, Android, web — passes through this file
 * untouched, so what reaches the App Store is unaffected by anything here.
 *
 * ── Why it has to exist ─────────────────────────────────────────────────────
 *
 * Xcode will sign a build with a personal Apple ID and install it on a phone
 * plugged into this Mac, which is the cheap way to see the app on real
 * hardware. What a personal team cannot do is sign the Push Notifications
 * capability. The expo-notifications config plugin adds the `aps-environment`
 * entitlement to every iOS build, so an unmodified prebuild fails at signing
 * with "Personal development teams do not support the Push Notifications
 * capability" — before it ever reaches the phone.
 *
 * So this strips the two things that entitlement brings with it. The cost is
 * exactly and only remote push on the local build: reminders still arrive,
 * because when no push token can be registered the app falls back to
 * scheduling them on the device itself (lib/push.ts, app/_layout.tsx). That
 * fallback is the same path a creator who declines the permission takes, so
 * this is a supported state rather than a broken one.
 *
 * ── Why the bundle identifier changes ───────────────────────────────────────
 *
 * Free provisioning registers the App ID against the personal team, and an ID
 * claimed that way is awkward to move to a paid team later. Burning
 * `in.blubanana.app` — the identifier the App Store listing will need — on a
 * throwaway test build is a trade worth avoiding, so the local build is
 * `in.blubanana.app.dev` and the real one stays untouched and unregistered.
 *
 * The `blubanana://` URL scheme is declared from `scheme` in app.json and does
 * not follow the bundle identifier, so password-recovery and OAuth deep links
 * still resolve on the dev build.
 */
const ENABLED = process.env.EXPO_LOCAL_IOS === '1'

const LOCAL_BUNDLE_ID = 'in.blubanana.app.dev'

module.exports = function withLocalIosSigning(config) {
  if (!ENABLED) return config

  config.ios = { ...config.ios, bundleIdentifier: LOCAL_BUNDLE_ID }

  // Tells lib/push.ts not to ask for a token. Without the entitlement,
  // getExpoPushTokenAsync throws rather than returning null, and the caller
  // treats a throw as "something broke" and skips the local schedule too, so
  // reminders would silently never arrive on this build. Read from the config
  // embedded at build time, which is why ios:local builds Release.
  config.extra = { ...config.extra, remotePushUnavailable: true }

  // This plugin is FIRST in app.json's plugins array, which is what makes the
  // strip work. Mods compose in reverse: withMod runs its own action and then
  // calls the mod registered before it, so the last plugin in the array runs
  // first and the first runs last. Listed after expo-notifications, this
  // deleted the entitlement a moment before that plugin wrote it, and the
  // build still failed to sign. Verified with `expo config --type introspect`.
  config = withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment']
    return c
  })

  config = withInfoPlist(config, (c) => {
    const modes = c.modResults.UIBackgroundModes
    if (Array.isArray(modes)) {
      const kept = modes.filter((mode) => mode !== 'remote-notification')
      // An empty UIBackgroundModes array is not the same as the key being
      // absent: Apple reads a declared-but-empty background mode as a
      // configuration mistake, so the key goes rather than emptying.
      if (kept.length) c.modResults.UIBackgroundModes = kept
      else delete c.modResults.UIBackgroundModes
    }
    return c
  })

  return config
}
