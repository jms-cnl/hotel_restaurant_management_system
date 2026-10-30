type SessionEnvironment = Pick<
    NodeJS.ProcessEnv,
    "HRMS_SESSION_ENCRYPTION_KEY" | "HRMS_SESSION_ENCRYPTION_KEY_VERSION"
>;

export type SessionEncryptionConfig = {
    key: Buffer;
    keyVersion: number;
};

export const parseSessionEncryptionConfig = (env: SessionEnvironment): SessionEncryptionConfig => {
    const encodedKey = env.HRMS_SESSION_ENCRYPTION_KEY?.trim();
    if (!encodedKey) {
        throw new Error("HRMS_SESSION_ENCRYPTION_KEY must be configured");
    }

    const key = Buffer.from(encodedKey, "base64");
    if (key.length !== 32 || key.toString("base64") !== encodedKey) {
        throw new Error("HRMS_SESSION_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
    }

    const versionText = env.HRMS_SESSION_ENCRYPTION_KEY_VERSION?.trim();
    const keyVersion = Number(versionText);
    if (!versionText || !Number.isInteger(keyVersion) || keyVersion < 1 || keyVersion > 32767) {
        throw new Error("HRMS_SESSION_ENCRYPTION_KEY_VERSION must be an integer from 1 to 32767");
    }

    return { key, keyVersion };
};

export const isServiceRoleCredential = (credential: string): boolean => {
    if (credential.startsWith("sb_secret_") && credential.length > "sb_secret_".length) {
        return true;
    }

    const parts = credential.split(".");
    if (parts.length !== 3 || !parts[1]) return false;

    try {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown };
        return payload.role === "service_role";
    } catch {
        return false;
    }
};
