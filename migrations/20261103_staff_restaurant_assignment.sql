-- A4: staff-restaurant assignment (already applied in Supabase, Nov 3, 2026)
create table public.staff_restaurant_assignment (
  user_id uuid not null references public."user"(user_id) on delete cascade,
  restaurant_id bigint not null references public.restaurant(restaurant_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);

create index staff_restaurant_assignment_restaurant_id_idx
  on public.staff_restaurant_assignment (restaurant_id);

alter table public.staff_restaurant_assignment enable row level security;

revoke all on public.staff_restaurant_assignment from anon;

create policy sra_select on public.staff_restaurant_assignment
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

create policy sra_insert on public.staff_restaurant_assignment
  for insert to authenticated
  with check (public.is_admin());

create policy sra_delete on public.staff_restaurant_assignment
  for delete to authenticated
  using (public.is_admin());
