import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createAdminSupportInboxModel } from "../adminSupportInbox";
import type { SupportMessageStatus } from "../adminSupportInbox";

type InboxModel = NonNullable<ReturnType<typeof createAdminSupportInboxModel>>;
const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export function AdminSupportInbox({ model }: { model?: InboxModel }) {
    const inbox = useMemo(() => model ?? createAdminSupportInboxModel("Admin")!, [model]);
    useSyncExternalStore(inbox.subscribe, inbox.getSnapshot, inbox.getSnapshot);
    useEffect(() => { if (!model) void inbox.load(); }, [inbox, model]);
    return <section className="admin-crud-page support-inbox-page">
        <div className="admin-page-heading"><div><p className="eyebrow">CUSTOMER CARE</p><h1>Support Inbox</h1><p className="staff-manage-description">Review and resolve customer messages.</p></div></div>
        {inbox.errorMessage && <div className="admin-crud-form-error" role="alert">{inbox.errorMessage}</div>}
        <div className="support-inbox-layout">
            <section className="support-inbox-list" aria-label="Support messages">
                <label className="support-inbox-filter">Status<select aria-label="Filter by status" value={inbox.statusFilter} onChange={event => inbox.setStatusFilter(event.target.value as "all" | SupportMessageStatus)}>
                    <option value="all">All statuses</option><option value="open">Open</option><option value="resolved">Resolved</option>
                </select></label>
                {inbox.isLoading ? <p role="status">Loading support messages…</p> : inbox.filteredMessages.length === 0
                    ? <div className="support-inbox-empty"><h2>No messages</h2><p>{inbox.emptyMessage}</p></div>
                    : <div className="admin-crud-table-wrap"><table className="admin-crud-table"><thead><tr><th>Subject</th><th>Customer</th><th>Status</th><th>Created</th></tr></thead><tbody>{inbox.filteredMessages.map(message => <tr key={message.support_message_id}><td><button type="button" className="support-inbox-subject" onClick={() => void inbox.selectMessage(message.support_message_id)}>{message.subject}</button></td><td>{message.customer_id}</td><td><span className={`admin-crud-status ${message.status}`}>{message.status}</span></td><td>{formatDate(message.created_at)}</td></tr>)}</tbody></table></div>}
            </section>
            <section className="support-inbox-detail" aria-label="Message detail">
                {inbox.selectedMessage ? <><div className="support-inbox-detail-heading"><span className={`admin-crud-status ${inbox.selectedMessage.status}`}>{inbox.selectedMessage.status}</span><button type="button" className="support-inbox-action" disabled={inbox.actionDisabled} onClick={() => void inbox.changeStatus()}>{inbox.isPending ? "Updating…" : inbox.selectedMessage.status === "open" ? "Resolve" : "Reopen"}</button></div>
                    <h2>{inbox.selectedMessage.subject}</h2><dl><div><dt>Customer</dt><dd>{inbox.selectedMessage.customer_id}</dd></div><div><dt>Created</dt><dd>{formatDate(inbox.selectedMessage.created_at)}</dd></div></dl><p className="support-inbox-message">{inbox.selectedMessage.message}</p></>
                    : <div className="support-inbox-empty"><h2>Select a message</h2><p>Choose a support message to view its details.</p></div>}
            </section>
        </div>
    </section>;
}
