const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    alias: {
      // Ensure React Native picks up the correct entry point
      '@tak-ps/node-tak': '@tak-ps/node-tak/dist/index.native.js',
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
