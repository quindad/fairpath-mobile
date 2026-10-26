const { withEntitlementsPlist } = require('expo/config-plugins');

/** Removes push + Sign in with Apple entitlements for Ad Hoc profiles that lack those capabilities. */
function withFairpathIosQaEntitlements(config) {
  const enabled =
    process.env.FAIRPATH_IOS_QA_MINIMAL === '1' || process.env.EAS_BUILD_PROFILE === 'development-signal';
  if (!enabled) return config;
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    delete cfg.modResults['com.apple.developer.applesignin'];
    return cfg;
  });
}

module.exports = withFairpathIosQaEntitlements;
