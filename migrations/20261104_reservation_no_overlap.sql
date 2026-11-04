create extension if not exists btree_gist with schema extensions;

alter table public.reservation
  add constraint reservation_room_no_overlap
  exclude using gist (
    room_id with =,
    daterange(check_in_date, check_out_date, '[)') with &&
  )
  where (reservation_type = 'HOTEL' and room_id is not null and status in ('Pending','Confirmed'));

alter table public.reservation
  add constraint reservation_table_no_overlap
  exclude using gist (
    table_id with =,
    tsrange(reservation_date + start_time, reservation_date + end_time, '[)') with &&
  )
  where (reservation_type = 'RESTAURANT' and table_id is not null and status in ('Pending','Confirmed'));
