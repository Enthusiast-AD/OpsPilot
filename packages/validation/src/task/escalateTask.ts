import {z} from 'zod';

export const escalateTaskSchema = z.object({
    reason: z.string().trim().min(10, {error: "Reason is required and must be at least 10 characters long"}).max(1000,{error: "Reason must be at most 1000 characters long"}).optional(),
    aiChatId: z.uuid({error: "Invalid AI Chat ID format"}).optional(),
}).strict(); // Ensure no extra fields are allowed