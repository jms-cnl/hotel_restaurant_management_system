export type EmailMessage = {
    to: string;
    subject: string;
    text: string;
    html: string;
    replyTo?: string;
};

export interface EmailSender {
    send(message: EmailMessage): Promise<{ providerMessageId?: string }>;
}

type BrevoEmailSenderOptions = {
    apiKey: string;
    from: string;
    fromName?: string;
    replyTo?: string;
    fetcher?: typeof fetch;
};

export class BrevoEmailError extends Error {
    constructor(public readonly statusCode: number) {
        super(`Brevo email request failed (HTTP ${statusCode})`);
        this.name = "BrevoEmailError";
    }
}

export class BrevoEmailSender implements EmailSender {
    constructor(private readonly options: BrevoEmailSenderOptions) {}

    async send(message: EmailMessage): Promise<{ providerMessageId?: string }> {
        const { apiKey, from, replyTo, fetcher = globalThis.fetch } = this.options;
        const fromName = this.options.fromName ?? "HRMS";
        const payload: Record<string, unknown> = {
            sender: { email: from, name: fromName },
            to: [{ email: message.to }],
            subject: message.subject,
            textContent: message.text,
            htmlContent: message.html,
        };
        const effectiveReplyTo = message.replyTo ?? replyTo;
        if (effectiveReplyTo) payload.replyTo = { email: effectiveReplyTo };

        const response = await fetcher("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new BrevoEmailError(response.status);

        const result: unknown = await response.json().catch(() => undefined);
        if (result && typeof result === "object" && "messageId" in result && typeof result.messageId === "string") {
            return { providerMessageId: result.messageId };
        }
        return {};
    }
}

const redactRecipient = (recipient: string) => {
    const atIndex = recipient.lastIndexOf("@");
    if (atIndex <= 0) return "[redacted]";
    return `${recipient[0]}***${recipient.slice(atIndex)}`;
};

export class ConsoleEmailSender implements EmailSender {
    async send(message: EmailMessage): Promise<{}> {
        console.info(`[Email] subject=${message.subject} to=${redactRecipient(message.to)}`);
        return {};
    }
}

export class NoopEmailSender implements EmailSender {
    readonly messages: EmailMessage[] = [];

    async send(message: EmailMessage): Promise<{}> {
        this.messages.push({ ...message });
        return {};
    }
}

export type EmailSenderEnvironment = Readonly<Record<string, string | undefined>>;

export const createEmailSender = (env: EmailSenderEnvironment = process.env): EmailSender => {
    const provider = env.EMAIL_PROVIDER?.trim().toLowerCase();
    if (!provider || provider === "console") return new ConsoleEmailSender();
    if (provider === "noop") return new NoopEmailSender();
    if (provider !== "brevo") throw new Error("EMAIL_PROVIDER must be brevo, console, or noop");

    const apiKey = env.BREVO_API_KEY?.trim();
    if (!apiKey) throw new Error("BREVO_API_KEY is required when EMAIL_PROVIDER=brevo");
    const from = env.EMAIL_FROM?.trim();
    if (!from) throw new Error("EMAIL_FROM is required when EMAIL_PROVIDER=brevo");
    const fromName = env.EMAIL_FROM_NAME?.trim();
    const replyTo = env.EMAIL_REPLY_TO?.trim();
    return new BrevoEmailSender({
        apiKey,
        from,
        ...(fromName ? { fromName } : {}),
        ...(replyTo ? { replyTo } : {}),
    });
};
