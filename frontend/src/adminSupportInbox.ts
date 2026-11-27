import { apiGet, apiPatch } from "./api";

export type SupportMessageStatus = "open" | "resolved";
export interface AdminSupportMessage {
    support_message_id: number;
    customer_id: string;
    customer?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
    subject: string;
    message: string;
    status: SupportMessageStatus;
    created_at: string;
}
export type SupportInboxRequest = (path: string, status?: SupportMessageStatus) => Promise<AdminSupportMessage[] | AdminSupportMessage>;

export const supportMessageCustomerLabel = (message: Pick<AdminSupportMessage, "customer_id" | "customer">) => {
    const firstName = message.customer?.first_name?.trim();
    const lastName = message.customer?.last_name?.trim();
    const email = message.customer?.email?.trim();
    return firstName && lastName && email ? `${firstName} ${lastName} (${email})` : message.customer_id;
};

const requestFromApi: SupportInboxRequest = (path, status) => status
    ? apiPatch<AdminSupportMessage>(path, { status })
    : path === "/support-messages"
        ? apiGet<AdminSupportMessage[]>(path)
        : apiGet<AdminSupportMessage>(path);

export const adminSupportNavigationLink = (role: string) => role === "Admin" ? { label: "Support", path: "/support-inbox" } : null;
export const supportInboxRedirectForRole = (role: string) => role === "Admin" ? null : "/home";

export function createAdminSupportInboxModel(role: string, request: SupportInboxRequest = requestFromApi) {
    if (role !== "Admin") return null;
    let messages: AdminSupportMessage[] = [];
    let selectedMessage: AdminSupportMessage | null = null;
    let statusFilter: "all" | SupportMessageStatus = "all";
    let isPending = false;
    let isLoading = false;
    let errorMessage = "";
    let revision = 0;
    const listeners = new Set<() => void>();
    const notify = () => { revision += 1; listeners.forEach(listener => listener()); };
    const model = {
        subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
        getSnapshot() { return revision; },
        get messages() { return messages; },
        get selectedMessage() { return selectedMessage; },
        get isLoading() { return isLoading; },
        get statusFilter() { return statusFilter; },
        get isPending() { return isPending; },
        get actionDisabled() { return isPending; },
        get errorMessage() { return errorMessage; },
        get emptyMessage() { return messages.length === 0 ? "No support messages found." : statusFilter === "all" ? "No support messages found." : `No ${statusFilter} support messages found.`; },
        get filteredMessages() { return statusFilter === "all" ? messages : messages.filter(message => message.status === statusFilter); },
        setStatusFilter(status: "all" | SupportMessageStatus) { statusFilter = status; notify(); },
        setMessages(next: AdminSupportMessage[]) { messages = next; notify(); },
        async load() {
            isLoading = true; errorMessage = ""; notify();
            try { messages = await request("/support-messages") as AdminSupportMessage[]; }
            catch { errorMessage = "Unable to load support messages. Please try again."; }
            finally { isLoading = false; notify(); }
        },
        async selectMessage(id: number) {
            errorMessage = ""; notify();
            try {
                const detail = await request(`/support-messages/${id}`);
                selectedMessage = Array.isArray(detail)
                    ? messages.find(message => message.support_message_id === id) ?? null
                    : detail as AdminSupportMessage;
            }
            catch { errorMessage = "Unable to load support message. Please try again."; }
            notify();
        },
        async changeStatus() {
            if (!selectedMessage || isPending) return;
            const nextStatus: SupportMessageStatus = selectedMessage.status === "open" ? "resolved" : "open";
            const id = selectedMessage.support_message_id;
            isPending = true; errorMessage = ""; notify();
            try {
                const updated = await request(`/support-messages/${id}/status`, nextStatus) as AdminSupportMessage;
                selectedMessage = updated;
                messages = messages.map(message => message.support_message_id === id ? updated : message);
            } catch { errorMessage = "Unable to update support message. Please try again."; }
            finally { isPending = false; notify(); }
        },
    };
    return model;
}
