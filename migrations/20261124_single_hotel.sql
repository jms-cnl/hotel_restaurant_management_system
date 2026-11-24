BEGIN;

-- Serialize the precondition check with all writes so the singleton guard cannot
-- race with a concurrent hotel insert or delete while this migration is applied.
LOCK TABLE public.hotel IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
    hotel_count bigint;
BEGIN
    SELECT COUNT(*) INTO hotel_count FROM public.hotel;
    IF hotel_count <> 1 THEN
        RAISE EXCEPTION 'A18 requires exactly one existing row in public.hotel; found %. Reconcile hotel rows and dependent rooms/restaurants before applying this migration.', hotel_count;
    END IF;
END
$$;

-- A constant expression makes every hotel row share the same unique key.
CREATE UNIQUE INDEX hotel_singleton_idx ON public.hotel ((true));

CREATE OR REPLACE FUNCTION public.prevent_hotel_create_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Hotel creation and deletion are disabled; edit the existing hotel instead.'
        USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER hotel_create_delete_blocked
BEFORE INSERT OR DELETE ON public.hotel
FOR EACH ROW
EXECUTE FUNCTION public.prevent_hotel_create_delete();

CREATE TRIGGER hotel_truncate_blocked
BEFORE TRUNCATE ON public.hotel
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_hotel_create_delete();

COMMIT;
