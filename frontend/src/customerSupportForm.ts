import { apiPost } from "./api";

export type CustomerSupportField = "subject" | "message";
type SupportPost = (path: string, body: unknown) => Promise<unknown>;

export const customerSupportNavigationLink = (roleName: string | undefined) =>
    roleName === "Customer" ? { label: "Support", path: "/support" } : null;

export const createCustomerSupportFormModel = (roleName: string, post: SupportPost = apiPost) => {
    if (roleName !== "Customer") return null;
    const fields = [
        { name: "subject" as const, label: "Subject", required: true, maxLength: 120 },
        { name: "message" as const, label: "Message", required: true, maxLength: 5000 },
    ];
    let values = { subject: "", message: "" };
    let errors: Partial<Record<CustomerSupportField, string>> = {};
    let successMessage = "";
    let errorMessage = "";
    let isSubmitting = false;
    const validate = () => {
        const next: Partial<Record<CustomerSupportField, string>> = {};
        if (!values.subject.trim()) next.subject = "Subject is required";
        else if (values.subject.trim().length > 120) next.subject = "Subject must be 120 characters or fewer";
        if (!values.message.trim()) next.message = "Message is required";
        else if (values.message.trim().length > 5000) next.message = "Message must be 5000 characters or fewer";
        errors = next;
        return { ...next };
    };
    return {
        fields,
        get values() { return { ...values }; },
        get errors() { return { ...errors }; },
        get successMessage() { return successMessage; },
        get errorMessage() { return errorMessage; },
        get isSubmitting() { return isSubmitting; },
        get submitDisabled() { return isSubmitting; },
        setField(field: CustomerSupportField, value: string) {
            values = { ...values, [field]: value };
            successMessage = "";
            errorMessage = "";
            if (errors[field]) validate();
        },
        validate,
        async submit() {
            successMessage = "";
            errorMessage = "";
            if (Object.keys(validate()).length || isSubmitting) return;
            isSubmitting = true;
            try {
                await post("/support-messages", { subject: values.subject.trim(), message: values.message.trim() });
                values = { subject: "", message: "" };
                errors = {};
                successMessage = "Support message sent successfully.";
            } catch {
                errorMessage = "Unable to send your support message. Please try again.";
            } finally {
                isSubmitting = false;
            }
        },
    };
};
