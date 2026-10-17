-- Food Rescue: additive columns on the existing, already security-tested marketplace_items/claims engine
-- (17 adversarial claim-safety tests already pass against that engine; this never touches claim logic, only
-- adds a same-day pickup WINDOW to the listing itself, separate from marketplace_claims.pickup_deadline, which
-- is the 48-hour grace period after someone claims -- these are two different timers for two different
-- purposes and both now apply together for a food-rescue listing).

alter table public.marketplace_items
  add column if not exists is_food_rescue boolean not null default false,
  add column if not exists pickup_window_start timestamptz,
  add column if not exists pickup_window_end timestamptz,
  add column if not exists best_by_note text;

alter table public.marketplace_items
  add constraint marketplace_items_food_window_order
  check (pickup_window_start is null or pickup_window_end is null or pickup_window_start < pickup_window_end);

create index if not exists marketplace_items_food_rescue_idx
  on public.marketplace_items (pickup_window_end)
  where is_food_rescue = true and status = 'available';
