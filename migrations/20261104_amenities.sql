-- A12: amenities (hotel-owned, optional room/restaurant links, browse-only)
-- Applied manually in Supabase on 2026-11-04.

create table public.amenity (
  amenity_id  bigint generated always as identity primary key,
  hotel_id    bigint not null references public.hotel(hotel_id) on delete cascade,
  name        varchar(100) not null,
  description text,
  created_at  timestamptz not null default now(),
  unique (hotel_id, name)
);

create table public.room_amenity (
  room_id    bigint not null references public.room(room_id) on delete cascade,
  amenity_id bigint not null references public.amenity(amenity_id) on delete cascade,
  primary key (room_id, amenity_id)
);
create index on public.room_amenity (amenity_id);

create table public.restaurant_amenity (
  restaurant_id bigint not null references public.restaurant(restaurant_id) on delete cascade,
  amenity_id    bigint not null references public.amenity(amenity_id) on delete cascade,
  primary key (restaurant_id, amenity_id)
);
create index on public.restaurant_amenity (amenity_id);

alter table public.amenity enable row level security;
alter table public.room_amenity enable row level security;
alter table public.restaurant_amenity enable row level security;

create policy "Authenticated can view amenities" on public.amenity
  for select to authenticated using (true);
create policy "Admins can manage amenities" on public.amenity
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Authenticated can view room amenities" on public.room_amenity
  for select to authenticated using (true);
create policy "Staff/Admin can manage room amenities" on public.room_amenity
  for all to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

create policy "Authenticated can view restaurant amenities" on public.restaurant_amenity
  for select to authenticated using (true);
create policy "Staff/Admin can manage restaurant amenities" on public.restaurant_amenity
  for all to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
