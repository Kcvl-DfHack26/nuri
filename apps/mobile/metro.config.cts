import expoMetroConfig = require('expo/metro-config');
import uniwindMetro = require('uniwind/metro');

export = uniwindMetro.withUniwindConfig(expoMetroConfig.getDefaultConfig(__dirname), {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
});
