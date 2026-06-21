import {z} from 'zod';

export const updateTaskSchema = z.object({
    title: z.string().trim().min(4,{error: "Title is required and must be at least 4 characters long"}).max(200,{error: "Title must be at most 200 characters long"}).optional(),
    description: z.string().trim().min(10, {error: "Description is required and must be at least 10 characters long"}).max(5000,{error: "Description must be at most 5000 characters long"}).optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'ESCALATED']).optional(),
    assignedUserId: z.uuid({error: "Invalid assigned user ID format"}).nullable().optional(),
})

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;