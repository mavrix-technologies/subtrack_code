const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to allow non-modular header imports and selectively disable modulemaps
 * specifically for React Native Firebase (RNFB) pod targets.
 *
 * Fixes iOS build errors with static frameworks:
 * - -Werror=non-modular-include-in-framework-module
 * - declaration of 'RCTBridgeModule' must be imported from module 'RNFBApp.RNFBAppModule'
 * while preserving module maps for Swift dependencies (e.g. FBLPromises).
 */
module.exports = function withNonModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return config;
      }
      let podfileContent = fs.readFileSync(podfilePath, 'utf8');

      const patch = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        if target.name.start_with?('RNFB')
          config.build_settings['DEFINES_MODULE'] = 'NO'
        end
      end
    end
`;

      if (!podfileContent.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        podfileContent = podfileContent.replace(
          /post_install do \|installer\|/g,
          `post_install do |installer|\n${patch}`
        );
        fs.writeFileSync(podfilePath, podfileContent, 'utf8');
      }

      return config;
    },
  ]);
};
