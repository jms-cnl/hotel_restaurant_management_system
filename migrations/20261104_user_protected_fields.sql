create or replace function public.prevent_user_privileged_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated' and not public.is_admin() then
    if new.user_id is distinct from old.user_id
       or new.role_id is distinct from old.role_id
       or new.email is distinct from old.email
       or new.created_at is distinct from old.created_at then
      raise exception 'Not allowed to change protected fields' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_protect_privileged_fields on public."user";
create trigger user_protect_privileged_fields
before update on public."user"
for each row execute function public.prevent_user_privileged_update();
