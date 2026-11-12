const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// SVG as React Native components (design assets from the Ardot file).
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts.push('svg', 'mjs');

// @expo/ui jetpack-compose IconButton imports `../Button` as a bare directory.
// With package exports enabled, Metro fails to pick up Button/index.js and the
// Android bundle 500s — unblock by pointing that relative import at the index.
const expoUiButtonIndex = path.resolve(
  __dirname,
  'node_modules/@expo/ui/build/jetpack-compose/Button/index.js',
);
const priorResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '../Button' &&
    typeof context.originModulePath === 'string' &&
    context.originModulePath.includes(`${path.sep}@expo${path.sep}ui${path.sep}`) &&
    context.originModulePath.includes(`${path.sep}IconButton${path.sep}`)
  ) {
    return { type: 'sourceFile', filePath: expoUiButtonIndex };
  }
  if (typeof priorResolveRequest === 'function') {
    return priorResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
