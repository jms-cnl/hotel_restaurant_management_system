ALTER TABLE public.support_message_admin_notification
    ADD COLUMN handled_at timestamptz;

GRANT UPDATE (handled_at)
    ON public.support_message_admin_notification
    TO authenticated;

DROP POLICY support_message_admin_notification_recipient_select
    ON public.support_message_admin_notification;

CREATE POLICY support_message_admin_notification_recipient_select
    ON public.support_message_admin_notification
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."user" u JOIN public.role r ON r.role_id = u.role_id
            WHERE u.user_id = auth.uid() AND r.role_name = 'Admin'
        )
    );

CREATE POLICY support_message_admin_notification_handled_update
    ON public.support_message_admin_notification
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."user" u JOIN public.role r ON r.role_id = u.role_id
            WHERE u.user_id = auth.uid() AND r.role_name = 'Admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."user" u JOIN public.role r ON r.role_id = u.role_id
            WHERE u.user_id = auth.uid() AND r.role_name = 'Admin'
        )
    );
