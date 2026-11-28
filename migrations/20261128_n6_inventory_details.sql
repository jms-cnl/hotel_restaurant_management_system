BEGIN;

ALTER TABLE public.room
    ADD COLUMN IF NOT EXISTS grace_period_minutes integer NOT NULL DEFAULT 30;
ALTER TABLE public.room
    ALTER COLUMN grace_period_minutes SET DEFAULT 30;
UPDATE public.room
    SET grace_period_minutes = 30
    WHERE grace_period_minutes IS NULL;
ALTER TABLE public.room
    ALTER COLUMN grace_period_minutes SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.room'::regclass
          AND conname = 'room_grace_period_minutes_check'
    ) THEN
        ALTER TABLE public.room
            ADD CONSTRAINT room_grace_period_minutes_check
            CHECK (grace_period_minutes BETWEEN 0 AND 1440);
    END IF;
END
$$;

ALTER TABLE public.restaurant_table
    ADD COLUMN IF NOT EXISTS grace_period_minutes integer NOT NULL DEFAULT 30;
ALTER TABLE public.restaurant_table
    ALTER COLUMN grace_period_minutes SET DEFAULT 30;
UPDATE public.restaurant_table
    SET grace_period_minutes = 30
    WHERE grace_period_minutes IS NULL;
ALTER TABLE public.restaurant_table
    ALTER COLUMN grace_period_minutes SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.restaurant_table'::regclass
          AND conname = 'restaurant_table_grace_period_minutes_check'
    ) THEN
        ALTER TABLE public.restaurant_table
            ADD CONSTRAINT restaurant_table_grace_period_minutes_check
            CHECK (grace_period_minutes BETWEEN 0 AND 30);
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.protect_room_table_capacity_grace()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF current_user IN ('service_role', 'postgres', 'supabase_admin') OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.capacity IS DISTINCT FROM OLD.capacity
       OR NEW.grace_period_minutes IS DISTINCT FROM OLD.grace_period_minutes THEN
        RAISE EXCEPTION 'Only Admins can change capacity or grace period'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS room_protect_capacity_grace ON public.room;
CREATE TRIGGER room_protect_capacity_grace
    BEFORE UPDATE ON public.room
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_room_table_capacity_grace();

DROP TRIGGER IF EXISTS restaurant_table_protect_capacity_grace ON public.restaurant_table;
CREATE TRIGGER restaurant_table_protect_capacity_grace
    BEFORE UPDATE ON public.restaurant_table
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_room_table_capacity_grace();

CREATE TABLE IF NOT EXISTS public.table_amenity (
    table_id bigint NOT NULL REFERENCES public.restaurant_table(table_id) ON DELETE CASCADE,
    amenity_id bigint NOT NULL REFERENCES public.amenity(amenity_id) ON DELETE CASCADE,
    PRIMARY KEY (table_id, amenity_id)
);

CREATE INDEX IF NOT EXISTS table_amenity_amenity_id_idx
    ON public.table_amenity (amenity_id);

ALTER TABLE public.table_amenity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.table_amenity FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_amenity TO authenticated;

DROP POLICY IF EXISTS "Admins can manage table amenities" ON public.table_amenity;
CREATE POLICY "Admins can manage table amenities"
    ON public.table_amenity FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff and admins can view table amenities" ON public.table_amenity;
CREATE POLICY "Staff and admins can view table amenities"
    ON public.table_amenity FOR SELECT TO authenticated
    USING (public.is_staff_or_admin());

COMMIT;
