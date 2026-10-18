# Credit Studio & FairPath+ E2E (092–100)

**Automated:** `npm run test:credit`, `npm run test:entitlements`, `npm run test:credit-member` (app loop).

## Credit (signed-in)

1. `/credit` → reports list; upload/add manual accounts.
2. Review items → stages explained without score promises (`test:credit` legal-safety).
3. Confirmed issue → `/credit/new-dispute` → letter builder (member sends themselves).
4. Signal: explain report/item, dispute draft (`cover-letter`-style credits on server).

## FairPath+

1. `/plus` → status from `my_fairpath_plus_status` (never client-granted).
2. Subscribe/restore buttons → billing provider; **honest** when store not configured (`not_configured`).
3. Marketplace quota copy matches entitlements (1 free / 7 Plus).

## Blocked (external)

- Apple/Google **IAP sandbox** proof for paid renewal — do not claim live billing until store + webhook path verified.
