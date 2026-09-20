# FairPath Marketplace — Test Matrix

## 10-minute smoke test
1. Open Marketplace logged out.
2. Search a keyword and city/state.
3. Filter a category and Safe Pickup.
4. Save an item while logged out → auth redirect.
5. Log in and save/unsave.
6. Confirm free plan quota reads 1/month or FairPath+ reads 7/month.
7. Open an item and request a claim.
8. Open My Claims and verify REQUESTED.
9. From the donor account, open My Listings → Manage Listing.
10. Verify claimant appears only as anonymous CLAIM #xxxx.
11. Approve the claim.
12. Claimant opens claim and sees 48-hour deadline + private pickup details + pickup code.
13. Donor marks ready.
14. Claimant sends pickup message; donor receives it.
15. Donor enters pickup code and verifies.
16. Claim becomes PICKED UP; item becomes CLAIMED.

## Claim quota tests
- Free user first monthly request succeeds.
- Free user second counted request blocks.
- FairPath+ allows up to 7 counted requests.
- Donor-declined request does not count.
- User cancellation before approval does not count.
- User cancellation after approval counts.
- No-show counts.
- Donor removes listing → active claim does not count.

## Bias/privacy tests
- Donor Claim Manager never displays claimant name.
- Donor Claim Manager never displays race or protected-profile data.
- Donor Claim Manager never displays claimant profile photo.
- Raw claim SELECT as seller should not expose claim rows through ordinary client access.
- Exact pickup address absent from public Marketplace item.
- Exact pickup address absent before approval.
- Approved claimant can access exact pickup details.
- Another signed-in user cannot access that claim receipt.

## Listing tests
- Create item with all required fields.
- Confirm price is always FREE / $0.
- Individual donor.
- Organization donor.
- Every category.
- Every condition.
- Quantity 1 and multiple quantity.
- Safe pickup on/off.
- Upload 1 photo.
- Upload 20 photos.
- Attempt 21st photo → DB rejects.
- Reorder photos; first is cover.
- Remove photo.
- Pause listing → disappears from browse.
- Relist → returns to browse.
- Remove listing → disappears and active claims cancel.

## Safety tests
- Report prohibited item.
- Report discriminatory behavior.
- Report pickup safety concern.
- Report requires signed-in user.
- Hidden/rejected moderation state is not public-readable.
- Exact pickup details never live in public description fields.

## Pickup tests
- Approval starts ~48h deadline.
- Code length = 6.
- Wrong code rejects.
- Correct code completes pickup.
- No-show before deadline blocks.
- No-show after deadline succeeds and item returns available.
- Messages only send while claim is APPROVED/READY.

## Code checks
Run:
```bash
npm run typecheck
npm run test:navigation
npm run test:housing
npm run test:marketplace
```

GitHub Actions remains manual-only until the full suite is intentionally green.
