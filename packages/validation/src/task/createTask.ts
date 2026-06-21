import {z} from 'zod';

export const createTaskSchema = z.object({
    id: z.uuid().optional(),
    title: z.string().trim().min(4,{error: "Title is required and must be at least 4 characters long"}).max(200,{error: "Title must be at most 200 characters long"}),
    description: z.string().trim().min(10, {error: "Description is required and must be at least 10 characters long"}).max(5000,{error: "Description must be at most 5000 characters long"}),
    assignedUserId: z.uuid({error: "Invalid assigned user ID format"}).nullable().optional(),
    checkListItems: z.array(z.object({
        id: z.uuid().optional(),
        content: z.string().trim().min(1,{error: "Checklist item content is required and must be at least 1 character long"}).max(500,{error: "Checklist item content must be at most 500 characters long"}),
    }).strict()).max(100, {error: "A task can have at most 100 checklist items"}).default([]), // Default to empty array if not provided
}).strict(); // Ensure no extra fields are allowed

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const paramsSchema = z.object({
    id: z.uuid(), // if IDs are UUIDs
});

export const toggleChecklistBodySchema = z.object({
    isCompleted: z.boolean(),
});