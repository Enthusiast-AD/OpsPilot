export interface User {
    id: string;
    email: string;
    role: "SUPERVISOR" | "WORKER";
    organizationId: string;
}

