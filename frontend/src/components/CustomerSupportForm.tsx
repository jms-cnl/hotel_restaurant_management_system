import { useMemo, useReducer, type FormEvent } from "react";
import { createCustomerSupportFormModel, type CustomerSupportField } from "../customerSupportForm";

export function CustomerSupportForm({ roleName = "Customer" }: { roleName?: string }) {
    const form = useMemo(() => createCustomerSupportFormModel(roleName), [roleName]);
    const [, refresh] = useReducer((version: number) => version + 1, 0);
    if (!form) return null;
    const change = (field: CustomerSupportField, value: string) => { form.setField(field, value); refresh(); };
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const pending = form.submit();
        refresh();
        await pending;
        refresh();
    };
    return <section className="customer-support-page">
        <header className="customer-support-heading"><p className="eyebrow">WE’RE HERE TO HELP</p><h1>Contact Support</h1><p>Send us a message and our team will follow up.</p></header>
        <form className="customer-support-form" onSubmit={submit} noValidate>
            <label htmlFor="support-subject">Subject</label>
            <input id="support-subject" name="subject" required maxLength={120} value={form.values.subject} aria-invalid={Boolean(form.errors.subject)} aria-describedby={form.errors.subject ? "support-subject-error" : undefined} onChange={event => change("subject", event.target.value)} />
            {form.errors.subject && <p id="support-subject-error" className="customer-support-field-error" role="alert">{form.errors.subject}</p>}
            <label htmlFor="support-message">Message</label>
            <textarea id="support-message" name="message" required maxLength={5000} rows={7} value={form.values.message} aria-invalid={Boolean(form.errors.message)} aria-describedby={form.errors.message ? "support-message-error" : undefined} onChange={event => change("message", event.target.value)} />
            {form.errors.message && <p id="support-message-error" className="customer-support-field-error" role="alert">{form.errors.message}</p>}
            {form.successMessage && <p className="customer-support-success" role="status">{form.successMessage}</p>}
            {form.errorMessage && <p className="customer-support-error" role="alert">{form.errorMessage}</p>}
            <button className="customer-support-submit" type="submit" disabled={form.submitDisabled}>{form.isSubmitting ? "Sending…" : "Send message"}</button>
        </form>
    </section>;
}
