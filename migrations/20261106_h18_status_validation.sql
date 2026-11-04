begin;

-- Normalize hotel status.
update public.hotel
set status = case lower(btrim(status))
  when 'active' then 'Active'
  when 'inactive' then 'Inactive'
  when 'suspended' then 'Suspended'
  else btrim(status)
end
where status is not null;

-- Normalize restaurant status.
update public.restaurant
set status = case lower(btrim(status))
  when 'active' then 'Active'
  when 'inactive' then 'Inactive'
  when 'suspended' then 'Suspended'
  else btrim(status)
end
where status is not null;

-- Normalize room status.
update public.room
set status = case lower(btrim(status))
  when 'available' then 'Available'
  when 'abilabol' then 'Available'
  when 'avilabols' then 'Available'
  when 'reserved' then 'Reserved'
  when 'occupied' then 'Occupied'
  when 'maintenance' then 'Maintenance'
  else btrim(status)
end
where status is not null;

-- Normalize restaurant table status.
update public.restaurant_table
set status = case lower(btrim(status))
  when 'available' then 'Available'
  when 'abilabol' then 'Available'
  when 'avilabols' then 'Available'
  when 'reserved' then 'Reserved'
  when 'occupied' then 'Occupied'
  when 'maintenance' then 'Maintenance'
  else btrim(status)
end
where status is not null;

alter table public.hotel
  add constraint hotel_status_allowed
  check (status is not null and status in ('Active', 'Inactive', 'Suspended'));

alter table public.restaurant
  add constraint restaurant_status_allowed
  check (status is not null and status in ('Active', 'Inactive', 'Suspended'));

alter table public.room
  add constraint room_status_allowed
  check (status is not null and status in ('Available', 'Reserved', 'Occupied', 'Maintenance'));

alter table public.restaurant_table
  add constraint restaurant_table_status_allowed
  check (status is not null and status in ('Available', 'Reserved', 'Occupied', 'Maintenance'));

commit;
