# Food Rescue posting — moved out of Mobile, for Command Center

**Decision (2026-10-16, Sterling):** a bakery or restaurant posting surplus food every day is a business/partner
workflow, not something an individual member does from their phone. The ability to CREATE a Food Rescue listing
has been removed from the Mobile app's `marketplace-list-item.tsx` screen. Members can still browse and claim
Food Rescue listings in Mobile (`src/app/food-rescue.tsx`, the Food Rescue banner on `src/app/marketplace.tsx`,
and the Food Rescue badge/pickup window on `src/app/market-item/[id].tsx` are all untouched and still live) —
only the posting form was pulled.

This doc preserves the exact UI and validation logic that was removed, so Command Center's future food-posting
flow (for Free Buff to build, per the explicit "Command Center is not something Juice works on" boundary) isn't
starting from zero.

## Database/API layer — unchanged, still live, reusable as-is

Nothing below was removed. The schema and service functions that already support Food Rescue are intact and
exactly what Command Center's new posting UI should call:

- `supabase/migrations/20261015120000_food_rescue.sql` — adds `is_food_rescue`, `pickup_window_start`,
  `pickup_window_end`, `best_by_note` to `public.marketplace_items`.
- `src/core/marketplace/marketplace-service.ts` — `createMarketplaceItem()` already accepts `isFoodRescue`,
  `pickupWindowStart`, `pickupWindowEnd`, `bestByNote` in its input type and passes them straight through to the
  insert. `loadMarketplace({ foodRescueOnly: true })` already sorts by `pickup_window_end` ascending for the
  claimant-facing feed.
- Every new listing (Food Rescue included) is still created `moderation_status='pending'` by the
  `guard_marketplace_owner_controlled_fields()` trigger — a business account posting from Command Center will
  need the same Admin approval step that member listings go through today
  (`fairpath-admin/src/app/marketplace/page.tsx` + `actions.ts`, already built).

## Removed UI — the exact form fields and validation (for reference)

State that was removed from `src/app/marketplace-list-item.tsx`:

```tsx
const [isFoodRescue,setIsFoodRescue]=useState(false);
const [pickupStartTime,setPickupStartTime]=useState('');
const [pickupEndTime,setPickupEndTime]=useState('');
const [bestByNote,setBestByNote]=useState('');

function timeToday(hhmm:string):string|null{
 const m=/^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());if(!m)return null;
 const h=Number(m[1]),min=Number(m[2]);if(h>23||min>59)return null;
 const d=new Date();d.setHours(h,min,0,0);return d.toISOString();
}
```

Validation that was removed from `validate()`:

```tsx
if(isFoodRescue){
 if(!pickupStartTime.trim()||!pickupEndTime.trim())return 'Add a pickup start and end time for this food rescue listing.';
 const start=timeToday(pickupStartTime),end=timeToday(pickupEndTime);
 if(!start||!end)return 'Pickup times must be in HH:MM 24-hour format, like 17:00.';
 if(start>=end)return 'Pickup end time must be after the start time.';
}
```

The toggle + conditional fields JSX that was removed:

```tsx
<Pressable accessibilityRole="button" style={[s.foodToggle,isFoodRescue&&s.foodToggleOn]} onPress={()=>setIsFoodRescue(v=>!v)}>
 <Lucide name="utensils" color={isFoodRescue?C.black:C.lime} size={15}/>
 <Text style={[s.foodToggleText,isFoodRescue&&s.foodToggleTextOn]}>{isFoodRescue?'THIS IS A FOOD RESCUE LISTING':'MARK AS FOOD RESCUE (SURPLUS FOOD)'}</Text>
</Pressable>
{isFoodRescue?<View style={s.foodBlock}>
 <Text style={s.foodHelp}>Food Rescue listings show up in a dedicated feed sorted by pickup time, so people can grab it before it's wasted. Pickup is today only — list again tomorrow if there's more.</Text>
 <View style={s.two}>
  <View style={{flex:1}}><Label text="PICKUP STARTS (24H, E.G. 17:00)"/><TextInput value={pickupStartTime} onChangeText={setPickupStartTime} style={s.field} placeholder="17:00" placeholderTextColor={C.muted} keyboardType="numbers-and-punctuation"/></View>
  <View style={{flex:1}}><Label text="PICKUP ENDS (24H, E.G. 19:00)"/><TextInput value={pickupEndTime} onChangeText={setPickupEndTime} style={s.field} placeholder="19:00" placeholderTextColor={C.muted} keyboardType="numbers-and-punctuation"/></View>
 </View>
 <Label text="BEST-BY / FOOD SAFETY NOTE (OPTIONAL)"/>
 <TextInput value={bestByNote} onChangeText={setBestByNote} style={s.field} placeholder="Example: best eaten today, kept refrigerated" placeholderTextColor={C.muted}/>
</View>:null}
```

## What Command Center's version should do differently (recommendation, not built)

A real daily posting flow for a bakery/restaurant should be faster than this one-off form was:
- Pre-fill the business's own name/address/contact every time instead of asking again.
- Let a repeat poster duplicate yesterday's listing and just change the pickup window and quantity.
- Possibly a simplified single-screen "what's left over today" flow instead of the full generic Marketplace
  form fields (condition, listing type, etc. don't really apply to a restaurant posting surplus food).

This is scoping input for whoever builds it, not a spec — Command Center work belongs to Free Buff.
