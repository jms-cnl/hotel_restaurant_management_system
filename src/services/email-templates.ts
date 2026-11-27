export type EmailTemplate = { subject: string; text: string; html: string };

const escapeHtml = (value: string | number) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const template = (subject: string, text: string): EmailTemplate => ({
    subject,
    text,
    html: `<p>${escapeHtml(text)}</p>`,
});

export const reservationCreatedTemplate = ({ bookingId }: { bookingId: string | number }): EmailTemplate =>
    template(`Reservation ${bookingId} received`, `Your reservation ${bookingId} has been created.`);

export const reservationStatusChangedTemplate = ({
    bookingId,
    status,
}: {
    bookingId: string | number;
    status: "confirmed" | "cancelled";
}): EmailTemplate => template(
    `Reservation ${bookingId} ${status}`,
    `The status of reservation ${bookingId} is now ${status}.`,
);

export const combinedBookingConfirmedTemplate = ({ bookingId }: { bookingId: string | number }): EmailTemplate =>
    template(`Combined booking ${bookingId} confirmed`, `Your combined booking ${bookingId} is confirmed.`);

export const supportMessageResolvedTemplate = ({ supportMessageId }: { supportMessageId: string | number }): EmailTemplate =>
    template(`Support message ${supportMessageId} resolved`, `Your support message ${supportMessageId} has been resolved.`);
