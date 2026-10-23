const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

/**
 * Raises every Pods target to the app's own minimum iOS version.
 *
 * Unconditional — unlike withLocalIosSigning this is not about signing, and
 * the setting it corrects is wrong in any build that Xcode 26 or newer
 * compiles.
 *
 * ── The failure it fixes ────────────────────────────────────────────────────
 *
 * The Podfile's `platform :ios` sets the app's minimum (15.1 on Expo 54, 16.4
 * from Expo 56), but a pod's *resource bundle* target keeps whatever its own
 * podspec declared, and on Expo 54 three of ours declared less:
 *
 *   RNCAsyncStorage-RNCAsyncStorage_resources   13.4
 *   RNSVG-RNSVGFilters                          12.4
 *   ReachabilitySwift-ReachabilitySwift         12.0
 *
 * Xcode 27 refuses any deployment target below 15.0 outright, so the build
 * stops with three errors before a line of app code is compiled. Raising them
 * drops no supported device: nothing can install this app below the app
 * target's own minimum anyway.
 *
 * The minimum is read from the Podfile's `platform :ios` at install time, not
 * written here, so an Expo upgrade that raises it cannot leave pods pinned to
 * an old number. Compared with Gem::Version, because '15.10'.to_f < 15.9.
 *
 * ── Why it patches the Podfile rather than the Pods project ─────────────────
 *
 * `pod install` regenerates the Pods project from the podspecs every time, so
 * a correction written there survives until the next install. The Podfile's
 * post_install hook is the supported place to reach those targets, and this
 * plugin reapplies the hook on every prebuild — which matters because `ios/`
 * is generated and deliberately not in git.
 *
 * The hook goes at the END of the existing post_install block, after
 * react_native_post_install has had its say, so nothing it does can put the
 * low values back.
 */
const MARKER = '# blubanana: raise pod deployment targets'

const HOOK = `
    ${MARKER}
    declared = installer.aggregate_targets
      .map { |t| t.platform.deployment_target }
      .compact.max
    raise 'blubanana: no platform :ios deployment target in the Podfile' if declared.nil?
    # Pod::Version and Gem::Version refuse to compare with each other.
    app_minimum = Gem::Version.new(declared.to_s)
    pod_projects = [installer.pods_project]
    pod_projects += installer.generated_projects if installer.respond_to?(:generated_projects)
    pod_projects.compact.uniq.each do |pod_project|
      configs = pod_project.build_configurations
      configs += pod_project.targets.flat_map { |t| t.build_configurations }
      configs.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < app_minimum
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = app_minimum.to_s
        end
      end
    end
`

module.exports = function withPodDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile')
      const contents = fs.readFileSync(podfile, 'utf8')

      if (contents.includes(MARKER)) return cfg

      // Anchor on the close of the react_native_post_install call inside the
      // post_install block. Deliberately throws rather than returning the file
      // untouched: a silent no-op here produces a project that fails to build
      // with three confusing Xcode errors, and the next person would have to
      // rediscover all of this. A loud failure at prebuild names the cause.
      const blockStart = contents.indexOf('post_install do |installer|')
      if (blockStart === -1) {
        throw new Error(
          'withPodDeploymentTarget: no post_install block in the generated Podfile. ' +
            'The Expo template changed shape; update this plugin.'
        )
      }
      const closeIndex = contents.indexOf('\n    )\n', blockStart)
      if (closeIndex === -1) {
        throw new Error(
          'withPodDeploymentTarget: could not find the end of react_native_post_install ' +
            'in the generated Podfile. The Expo template changed shape; update this plugin.'
        )
      }
      const insertAt = closeIndex + '\n    )\n'.length

      fs.writeFileSync(podfile, contents.slice(0, insertAt) + HOOK + contents.slice(insertAt))
      return cfg
    },
  ])
}
