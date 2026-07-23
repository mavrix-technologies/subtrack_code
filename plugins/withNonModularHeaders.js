const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to allow non-modular header imports and disable modulemap definitions for Pod targets.
 * Fixes Clang errors (-Werror=non-modular-include-in-framework-module & RCTBridgeModule module import errors)
 * when using static frameworks with React Native Firebase (RNFBApp) on iOS.
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
        config.build_settings['DEFINES_MODULE'] = 'NO'
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
