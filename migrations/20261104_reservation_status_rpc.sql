create or replace function public.change_reservation_status_with_history(
  p_reservation_id bigint,
  p_status text,
  p_remarks text,
  p_changed_by uuid
)
returns public.reservation
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reservation public.reservation;
  v_row_count bigint;
begin
  if v_actor is null or p_changed_by is distinct from v_actor then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select *
  into v_reservation
  from public.reservation
  where reservation_id = p_reservation_id
  for update;

  if not found then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;

  if not (
    (v_reservation.status = 'Pending' and p_status in ('Confirmed', 'Rejected', 'Cancelled'))
    or (v_reservation.status = 'Confirmed' and p_status in ('Completed', 'Cancelled'))
  ) then
    raise exception 'Invalid reservation status transition: % to %', v_reservation.status, p_status
      using errcode = '22023';
  end if;

  update public.reservation
  set status = p_status,
      updated_at = now()
  where reservation_id = p_reservation_id
  returning * into v_reservation;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'FORBIDDEN: Reservation update not permitted' using errcode = 'P0001';
  end if;

  insert into public.reservation_status_history
    (reservation_id, changed_by, status, remarks)
  values
    (p_reservation_id, v_actor, p_status, p_remarks);

  return v_reservation;
end;
$$;

revoke all on function public.change_reservation_status_with_history(bigint, text, text, uuid)
  from public, anon;
grant execute on function public.change_reservation_status_with_history(bigint, text, text, uuid)
  to authenticated;

create or replace function public.change_combined_booking_status_with_history(
  p_combined_booking_id bigint,
  p_status text,
  p_remarks text,
  p_changed_by uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.combined_booking;
  v_child record;
  v_reservations jsonb;
  v_row_count bigint;
  v_child_count bigint := 0;
begin
  if v_actor is null or p_changed_by is distinct from v_actor then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select *
  into v_booking
  from public.combined_booking
  where combined_booking_id = p_combined_booking_id
  for update;

  if not found then
    raise exception 'Combined booking not found' using errcode = 'P0002';
  end if;

  if not (
    (v_booking.status = 'Pending' and p_status in ('Confirmed', 'Rejected', 'Cancelled'))
    or (v_booking.status = 'Confirmed' and p_status in ('Completed', 'Cancelled'))
  ) then
    raise exception 'Invalid combined booking status transition: % to %', v_booking.status, p_status
      using errcode = '22023';
  end if;

  for v_child in
    select reservation_id, status
    from public.reservation
    where combined_booking_id = p_combined_booking_id
    order by reservation_id
    for update
  loop
    v_child_count := v_child_count + 1;
    if not (
      (v_child.status = 'Pending' and p_status in ('Confirmed', 'Rejected', 'Cancelled'))
      or (v_child.status = 'Confirmed' and p_status in ('Completed', 'Cancelled'))
    ) then
      raise exception 'Child reservation cannot transition from % to %', v_child.status, p_status
        using errcode = '22023';
    end if;
  end loop;

  update public.combined_booking
  set status = p_status
  where combined_booking_id = p_combined_booking_id
  returning * into v_booking;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'FORBIDDEN: Combined booking update not permitted' using errcode = 'P0001';
  end if;

  update public.reservation
  set status = p_status,
      updated_at = now()
  where combined_booking_id = p_combined_booking_id;

  get diagnostics v_row_count = row_count;
  if v_row_count <> v_child_count then
    raise exception 'FORBIDDEN: Reservation update not permitted' using errcode = 'P0001';
  end if;

  insert into public.reservation_status_history
    (reservation_id, changed_by, status, remarks)
  select reservation_id,
         v_actor,
         p_status,
         coalesce(p_remarks, 'Status changed through combined booking')
  from public.reservation
  where combined_booking_id = p_combined_booking_id;

  select coalesce(
    jsonb_agg(jsonb_build_object('reservation_id', reservation_id, 'user_id', user_id) order by reservation_id),
    '[]'::jsonb
  )
  into v_reservations
  from public.reservation
  where combined_booking_id = p_combined_booking_id;

  return jsonb_build_object(
    'combined_booking', to_jsonb(v_booking),
    'reservations', v_reservations
  );
end;
$$;

revoke all on function public.change_combined_booking_status_with_history(bigint, text, text, uuid)
  from public, anon;
grant execute on function public.change_combined_booking_status_with_history(bigint, text, text, uuid)
  to authenticated;
