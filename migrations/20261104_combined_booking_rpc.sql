create or replace function public.create_combined_booking(p_reservations jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cb combined_booking;
  v_res jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if jsonb_typeof(p_reservations) is distinct from 'array'
     or jsonb_array_length(p_reservations) <> 2
     or (select count(*) from jsonb_array_elements(p_reservations) e
         where e->>'reservation_type' = 'HOTEL' and e->>'room_id' is not null) <> 1
     or (select count(*) from jsonb_array_elements(p_reservations) e
         where e->>'reservation_type' = 'RESTAURANT' and e->>'table_id' is not null) <> 1 then
    raise exception 'Combined booking requires exactly 1 room and 1 table' using errcode = '22023';
  end if;

  insert into combined_booking (user_id, status)
  values (v_uid, 'Pending')
  returning * into v_cb;

  insert into reservation (user_id, reservation_type, room_id, table_id,
    check_in_date, check_out_date, reservation_date, start_time, end_time,
    status, special_request, combined_booking_id)
  select v_uid, r.reservation_type,
    case when r.reservation_type = 'HOTEL' then r.room_id end,
    case when r.reservation_type = 'RESTAURANT' then r.table_id end,
    r.check_in_date, r.check_out_date, r.reservation_date, r.start_time, r.end_time,
    'Pending', r.special_request, v_cb.combined_booking_id
  from jsonb_to_recordset(p_reservations) as r(
    reservation_type varchar, room_id bigint, table_id bigint,
    check_in_date date, check_out_date date, reservation_date date,
    start_time time, end_time time, special_request text);

  insert into reservation_status_history (reservation_id, changed_by, status, remarks)
  select reservation_id, v_uid, 'Pending', 'Reservation created through combined booking'
  from reservation
  where combined_booking_id = v_cb.combined_booking_id;

  select jsonb_agg(to_jsonb(x) order by x.reservation_id) into v_res
  from reservation x
  where x.combined_booking_id = v_cb.combined_booking_id;

  return to_jsonb(v_cb) || jsonb_build_object('reservations', v_res);
end;
$$;

revoke all on function public.create_combined_booking(jsonb) from public, anon;
grant execute on function public.create_combined_booking(jsonb) to authenticated;
