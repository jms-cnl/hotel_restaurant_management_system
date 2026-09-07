export const PASSWORD_REQUIREMENTS = [
    "At least 8 characters",
    "At least one uppercase letter",
    "At least one lowercase letter",
    "At least one number",
    "At least one special character"
] as const;

export const getPasswordErrors = (password: string) => {
    const errors: string[] = [];
    if (password.length < 8) errors.push(PASSWORD_REQUIREMENTS[0]);
    if (!/[A-Z]/.test(password)) errors.push(PASSWORD_REQUIREMENTS[1]);
    if (!/[a-z]/.test(password)) errors.push(PASSWORD_REQUIREMENTS[2]);
    if (!/[0-9]/.test(password)) errors.push(PASSWORD_REQUIREMENTS[3]);
    if (!/[^A-Za-z0-9]/.test(password)) errors.push(PASSWORD_REQUIREMENTS[4]);
    return errors;
};

export const assertPasswordPolicy = (password: unknown) => {
    if (typeof password !== "string") throw new Error("Password is required");
    const errors = getPasswordErrors(password);
    if (errors.length) throw new Error(`Password does not meet the requirements: ${errors.join(", ")}`);
};
