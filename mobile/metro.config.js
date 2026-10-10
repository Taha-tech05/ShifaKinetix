// Learn more https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 3D model files must be treated as assets (not source) so require('x.glb') works.
for (const ext of ['glb', 'gltf', 'bin']) {
  if (!config.resolver.assetExts.includes(ext)) config.resolver.assetExts.push(ext);
}

// @react-three/fiber/native does require('three'), which resolves to three's CJS build.
// That build calls process.emitWarning (missing on Hermes) at load time and crashes the app.
// Force the ESM build instead.
const threeEsm = path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.js');
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: threeEsm };
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
