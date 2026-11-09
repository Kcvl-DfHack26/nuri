const { getDefaultConfig } = require('expo/metro-config') as typeof import('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro') as typeof import('uniwind/metro');

module.exports = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
});
