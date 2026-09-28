// Metro config. Default Expo SDK 57 config, with one change:
//
// unstable_enablePackageExports (on by default in recent Expo SDKs) makes Metro resolve a package's "exports" map
// using the "import"/"module" condition. For 'tslib' that resolves to tslib.es6.mjs, an ES module with no `default`
// export. 'docx' (and other CJS packages built with TypeScript's tslib helpers) call `require('tslib')` and expect
// the CJS shape (tslib.js), so Metro's interop wrapper ends up with `tslib.default === undefined`, and any tslib
// helper call throws "Cannot destructure property '__extends' of 'tslib.default' as it is undefined" the first
// time a package reaching 'docx' is loaded on web. This broke every client-side DOCX/PDF export in the browser
// (Credit dispute letters, Record Relief packets, Resume Studio) — confirmed by testing a signed-in export.
//
// Disabling package-exports resolution reverts to Metro's pre-SDK-52 behavior (resolve via "main"/"browser"),
// which is what every dependency here was already built and tested against.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
