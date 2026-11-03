-- D4 step 3: restaurant.hotel_id required (already applied in Supabase, Nov 3, 2026)
alter table public.restaurant
  alter column hotel_id set not null;
