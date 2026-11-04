export type AdminManagementUser = {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string | null;
};

export function canChangeUserRole(userId: string, currentUserId: string | undefined, role: string | null): boolean {
    return role !== "Admin" && userId !== currentUserId;
}

export function confirmRoleChange(currentRole: string | null, nextRole: string, confirm: (message: string) => boolean): boolean {
    if (currentRole !== "Staff" || nextRole !== "Customer") return true;
    return confirm("Demote to Customer? Their restaurant assignments will be removed.");
}

export function staffUsers<T extends AdminManagementUser>(users: T[]): T[] {
    return users.filter((user) => user.role === "Staff");
}
