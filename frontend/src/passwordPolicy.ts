export const passwordRequirements = [
    "At least 8 characters",
    "At least one uppercase letter",
    "At least one lowercase letter",
    "At least one number",
    "At least one special character"
];

export const passwordErrors = (password: string) => [
    password.length >= 8 ? "" : passwordRequirements[0],
    /[A-Z]/.test(password) ? "" : passwordRequirements[1],
    /[a-z]/.test(password) ? "" : passwordRequirements[2],
    /[0-9]/.test(password) ? "" : passwordRequirements[3],
    /[^A-Za-z0-9]/.test(password) ? "" : passwordRequirements[4]
].filter(Boolean);
