drop policy "Staff and admins can manage hotels" on public.hotel;

create policy "Admins can manage hotels"
  on public.hotel
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
