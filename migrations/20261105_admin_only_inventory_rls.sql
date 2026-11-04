BEGIN;

DROP POLICY IF EXISTS "Staff/Admin can manage room amenities" ON public.room_amenity;
CREATE POLICY "Admins can manage room amenities"
    ON public.room_amenity FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff/Admin can manage restaurant amenities" ON public.restaurant_amenity;
CREATE POLICY "Admins can manage restaurant amenities"
    ON public.restaurant_amenity FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff and admins can insert media" ON public.media;
CREATE POLICY "Admins can insert media"
    ON public.media FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff and admins can update media" ON public.media;
CREATE POLICY "Admins can update media"
    ON public.media FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff and admins can delete media" ON public.media;
CREATE POLICY "Admins can delete media"
    ON public.media FOR DELETE TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "staff and admins can upload reservation media files" ON storage.objects;
CREATE POLICY "Admins can upload reservation media files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'reservation-media'
        AND name ~ '^(hotels|restaurants|rooms|tables)/[0-9]+/[0-9a-f-]+\.(jpg|png|webp)$'
        AND (
            (split_part(name, '/', 1) = 'hotels' AND EXISTS (SELECT 1 FROM public.hotel h WHERE h.hotel_id = CASE WHEN split_part(name, '/', 2) ~ '^[0-9]+$' THEN split_part(name, '/', 2)::bigint END))
            OR (split_part(name, '/', 1) = 'restaurants' AND EXISTS (SELECT 1 FROM public.restaurant r WHERE r.restaurant_id = CASE WHEN split_part(name, '/', 2) ~ '^[0-9]+$' THEN split_part(name, '/', 2)::bigint END))
            OR (split_part(name, '/', 1) = 'rooms' AND EXISTS (SELECT 1 FROM public.room rm WHERE rm.room_id = CASE WHEN split_part(name, '/', 2) ~ '^[0-9]+$' THEN split_part(name, '/', 2)::bigint END))
            OR (split_part(name, '/', 1) = 'tables' AND EXISTS (SELECT 1 FROM public.restaurant_table t WHERE t.table_id = CASE WHEN split_part(name, '/', 2) ~ '^[0-9]+$' THEN split_part(name, '/', 2)::bigint END))
        )
        AND public.is_admin()
    );

DROP POLICY IF EXISTS "staff and admins can update reservation media files" ON storage.objects;
CREATE POLICY "Admins can update reservation media files"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'reservation-media'
        AND name ~ '^(hotels|restaurants|rooms|tables)/[0-9]+/[0-9a-f-]+\.(jpg|png|webp)$'
        AND public.is_admin()
    )
    WITH CHECK (
        bucket_id = 'reservation-media'
        AND name ~ '^(hotels|restaurants|rooms|tables)/[0-9]+/[0-9a-f-]+\.(jpg|png|webp)$'
        AND (
            (split_part(name, '/', 1) = 'hotels' AND EXISTS (SELECT 1 FROM public.hotel h WHERE h.hotel_id = CASE WHEN split_part(name, '/', 2) ~ '^[0-9]+$' THEN split_part(name, '/', 2)::bigint END))
            OR (split_part(name, '/', 1) = 'restaurants' AND EXISTS (SELECT 1 FROM public.restaurant r WHERE r.restaurant_id = CASE WHEN split_part(name, '/', 2) ~ '^[0-9]+$' THEN split_part(name, '/', 2)::bigint END))
            OR (split_part(name, '/', 1) = 'rooms' AND EXISTS (SELECT 1 FROM public.room rm WHERE rm.room_id = CASE WHEN split_part(name, '/', 2) ~ '^[0-9]+$' THEN split_part(name, '/', 2)::bigint END))
            OR (split_part(name, '/', 1) = 'tables' AND EXISTS (SELECT 1 FROM public.restaurant_table t WHERE t.table_id = CASE WHEN split_part(name, '/', 2) ~ '^[0-9]+$' THEN split_part(name, '/', 2)::bigint END))
        )
        AND public.is_admin()
    );

DROP POLICY IF EXISTS "staff and admins can delete reservation media files" ON storage.objects;
CREATE POLICY "Admins can delete reservation media files"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'reservation-media'
        AND public.is_admin()
    );

COMMIT;
