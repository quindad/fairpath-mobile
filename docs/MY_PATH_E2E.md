# My Path E2E (086–091)

**Automated:** `npm run test:my-path`, `npm run test:member` (next-step rules).

## Today (shipped)

1. Bottom nav **My Path** → honest banner (device-local plan, no server sync yet).
2. **Ask Signal** → `member-focus-guidance` (1 credit); signed-out → `/sign-in?returnTo=/my-path`.
3. **Academy**, **My Assignment** (DEV demo label), **Veterans** service profile (AsyncStorage).

## Planned (labeled in UI)

- Cross-device sync, case-manager tasks, unified applications timeline — listed under “Coming to My Path”, not hidden.

## Related

- Home **MY PATH** shortcut; `/home` member strip links here.
- Deterministic next steps: `src/core/profile/next-step.ts` (used by HomeStatus / Assistant).
