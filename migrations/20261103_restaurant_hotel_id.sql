-- Restaurant-to-hotel relationship. Review and apply manually in Supabase; this file is not executed by the application.

ALTER TABLE public.restaurant
    ADD COLUMN IF NOT EXISTS hotel_id bigint;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'restaurant_hotel_id_fkey'
          AND conrelid = 'public.restaurant'::regclass
    ) THEN
        ALTER TABLE public.restaurant
            ADD CONSTRAINT restaurant_hotel_id_fkey
            FOREIGN KEY (hotel_id)
            REFERENCES public.hotel(hotel_id)
            ON DELETE RESTRICT;
    END IF;
END
$$;

UPDATE public.restaurant
SET hotel_id = 8
WHERE hotel_id IS NULL;

CREATE INDEX IF NOT EXISTS restaurant_hotel_id_idx
    ON public.restaurant (hotel_id);
