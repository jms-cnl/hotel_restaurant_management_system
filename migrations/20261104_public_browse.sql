-- A13: allow anonymous browse access (already applied live).

grant select on public.hotel,
  public.room,
  public.restaurant,
  public.restaurant_table,
  public.amenity,
  public.room_amenity,
  public.restaurant_amenity
to anon;

create policy "Public can view hotels" on public.hotel
  for select to anon using (true);
create policy "Public can view rooms" on public.room
  for select to anon using (true);
create policy "Public can view restaurants" on public.restaurant
  for select to anon using (true);
create policy "Public can view restaurant tables" on public.restaurant_table
  for select to anon using (true);
create policy "Public can view amenities" on public.amenity
  for select to anon using (true);
create policy "Public can view room amenities" on public.room_amenity
  for select to anon using (true);
create policy "Public can view restaurant amenities" on public.restaurant_amenity
  for select to anon using (true);
